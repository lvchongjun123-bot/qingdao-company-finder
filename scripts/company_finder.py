#!/usr/bin/env python3
"""
公司发现工具 - 鼠标圈定区域 + 自动搜索 + 智能打分
==================================================
用法:
  1. 浏览器打开 map_selector.html -> 在地图上圈选区域 -> 下载 area.json
  2. python company_finder.py          # 基础模式（快速）
  3. python company_finder.py --deep   # 深度模式（联网查公司规模）

输出: output/<区域>_公司列表_<日期>.csv
"""

import json
import csv
import os
import sys
import time
import re
import math
import hashlib
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

import requests

# ============================================================
# 配置区 - 使用前修改
# ============================================================
AMAP_WEB_KEY = "b756c2d47e44c7a36768bd8f2d2d7665"  # 高德 Web API Key (https://lbs.amap.com/)
MY_ADDRESS = "青岛市黄岛区学院路288号"     # 你的地址
OUTPUT_DIR = "output"

# 搜索关键词
SEARCH_KEYWORDS = [
    "科技有限公司",
    "信息技术有限公司",
    "软件有限公司",
    "网络科技有限公司",
    "互联网",
    "大数据",
    "云计算",
    "人工智能",
    "物联网",
    "电子商务",
    "数字科技",
    "智能科技",
]

# 匹配你技能的行业标签
MATCHING_CATEGORIES = [
    "科技", "软件", "信息技术", "网络", "互联网",
    "通信", "电子", "计算机", "自动化", "数据",
]


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}")


def safe_request(url, params, retries=3, timeout=10):
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=timeout,
                              headers={"User-Agent": "CompanyFinder/1.0"})
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1 * (attempt + 1))
            else:
                log(f"  request failed: {url[:60]}... - {e}")
                return None


def geocode(address, city="青岛"):
    url = "https://restapi.amap.com/v3/geocode/geo"
    data = safe_request(url, {
        "key": AMAP_WEB_KEY,
        "address": address,
        "city": city,
        "output": "JSON"
    })
    if data and data.get("status") == "1" and data.get("geocodes"):
        loc = data["geocodes"][0]["location"]
        lng, lat = loc.split(",")
        return float(lng), float(lat)
    return None


def haversine(lng1, lat1, lng2, lat2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * \
        math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def polygon_search(keyword, polygon_str, page=1):
    url = "https://restapi.amap.com/v3/place/polygon"
    params = {
        "key": AMAP_WEB_KEY,
        "polygon": polygon_str,
        "keywords": keyword,
        "offset": 20,
        "page": page,
        "extensions": "all",
        "output": "JSON"
    }
    return safe_request(url, params)


def search_all_companies(polygon_str):
    all_results = {}
    seen = set()

    for kw in SEARCH_KEYWORDS:
        log(f"  searching: '{kw}'")
        page = 1
        while True:
            data = polygon_search(kw, polygon_str, page)
            if not data or data.get("status") != "1":
                break

            pois = data.get("pois", [])
            if not pois:
                break

            for poi in pois:
                key = hashlib.md5(
                    f"{poi.get('name','')}|{poi.get('address','')}".encode()
                ).hexdigest()
                if key not in seen:
                    seen.add(key)
                    all_results[key] = poi

            total = int(data.get("count", 0))
            if page * 20 >= min(total, 900):
                break
            page += 1
            time.sleep(0.3)

    return list(all_results.values())


# ============================================================
# 打分引擎
# ============================================================

def calc_company_type_score(name):
    """公司正规度评分 0-100。个体户和工作室直接排除，外企独资顶分。"""
    # 外资企业 — 顶分
    if any(k in name for k in ["外商独资", "外国法人独资", "外资", "外商投资"]):
        return 100, "外企独资"
    if "中外合资" in name or "中外合作" in name:
        return 95, "中外合资"
    if "股份有限公司" in name:
        return 100, "股份公司"
    if "有限责任公司" in name:
        return 90, "有限公司"
    if "有限合伙" in name:
        return 60, "有限合伙"
    if "有限公司" in name:
        return 85, "有限公司(简)"
    # 排除项
    if "个体工商户" in name:
        return -1, "个体户(排除)"
    if "工作室" in name:
        return -1, "工作室(排除)"
    if any(s in name for s in ["公司", "中心", "院", "所", "部"]):
        return 50, "其他机构"
    return -1, "类型不明(排除)"


def calc_industry_match(name, biz_type, category):
    """行业匹配度 0-100"""
    text = f"{name} {biz_type} {category}"
    score = 0
    for kw in MATCHING_CATEGORIES:
        if kw in text:
            score += 15
    non_tech = ["餐饮", "美容", "健身", "教育", "装修", "房产", "物流",
                "食品", "服装", "建材", "旅游", "酒店"]
    for kw in non_tech:
        if kw in text:
            score -= 20
    return max(0, min(100, score + 30))


def calc_distance_score(lng, lat, home_coords):
    """距离得分 0-100。以7公里为基数，7公里内满分，超出递减。"""
    if not home_coords or not lng or not lat:
        return 50
    dist = haversine(lng, lat, *home_coords)
    if dist <= 7:
        return 100
    if dist <= 10:
        return 80
    if dist <= 15:
        return 60
    if dist <= 20:
        return 40
    if dist <= 30:
        return 20
    return 5


def calc_contact_score(poi):
    """联系方式得分 0-100"""
    score = 0
    if poi.get("tel"):     score += 50
    if poi.get("website"): score += 30
    if poi.get("email"):   score += 20
    if poi.get("photos"):  score += 10
    return min(100, score + 20)


def calc_scale_score(name, poi):
    """规模估算得分 0-100"""
    score = 30
    if "集团" in name:                    score += 40
    if "分公司" in name or "子公司" in name: score += 20
    if "连锁" in name:                    score += 10

    biz_type = poi.get("biz_type", "")
    type_info = poi.get("type", "")

    if any(k in biz_type for k in ["科技", "高新", "园区"]):
        score += 10
    if any(k in type_info for k in ["商务写字楼", "公司企业"]):
        score += 10
    if poi.get("business_area"):
        score += 5

    rating = poi.get("biz_ext", {}).get("rating", "")
    if rating:
        try:
            r = float(rating)
            if r > 4:   score += 10
            elif r > 3: score += 5
        except (ValueError, TypeError):
            pass

    return min(100, score)


def search_company_scale(name):
    """通过搜索引擎公开片段估算公司规模与成立时间（深度模式）"""
    result = {
        "registered_capital": "",
        "capital_amount": 0,      # 注册资本金额（万元）
        "employees": "",
        "has_jobs": False,
        "established_year": 0,    # 成立年份
        "score": 0
    }

    try:
        query = f"{name} 注册资本 成立时间"
        url = f"https://www.bing.com/search?q={quote(query)}&mkt=zh-CN"
        resp = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }, timeout=8)
        text = resp.text

        # 找注册资本
        m = re.search(r"注册资本[：:\s]*(\d+[\.\d]*)\s*万", text)
        if m:
            amount = float(m.group(1))
            result["registered_capital"] = f"{amount}万元"
            result["capital_amount"] = amount

        # 找参保人数
        m = re.search(r"参保人数[：:\s]*(\d+)", text)
        if m:
            result["employees"] = f"{m.group(1)}人"

        # 找成立时间
        m = re.search(r"成立(?:时间|日期|于)[：:\s]*(\d{4})", text)
        if m:
            result["established_year"] = int(m.group(1))

        # 是否有招聘
        if "招聘" in text and name[:4] in text:
            result["has_jobs"] = True
    except Exception:
        pass

    # 打分：注册资本权重最大
    capital = result["capital_amount"]
    if capital >= 1000:
        result["score"] += 35       # 1000万以上 → 大规模
    elif capital >= 500:
        result["score"] += 28
    elif capital >= 200:
        result["score"] += 20
    elif capital >= 100:
        result["score"] += 12
    elif capital > 0:
        result["score"] += 6        # 低于100万 → 小规模

    # 成立时间打分：越短越不正规
    year = result["established_year"]
    current_year = datetime.now().year
    if year > 0:
        age = current_year - year
        if age >= 10:
            result["score"] += 20   # 10年以上 → 非常正规
        elif age >= 5:
            result["score"] += 15
        elif age >= 3:
            result["score"] += 10
        elif age >= 1:
            result["score"] += 5
        else:
            result["score"] -= 10   # 成立不到1年 → 扣分

    if result["employees"]:   result["score"] += 10
    if result["has_jobs"]:    result["score"] += 10
    if result["score"] == 0:  result["score"] = 10

    return result


# ============================================================
# 主流程
# ============================================================

def score_company(poi, home_coords, deep_mode=False):
    name = poi.get("name", "未知")
    biz_type = poi.get("biz_type", "")
    category = poi.get("type", "")
    lng = lat = None
    loc = poi.get("location", "")
    if loc and "," in loc:
        parts = loc.split(",")
        try:
            lng, lat = float(parts[0]), float(parts[1])
        except ValueError:
            pass

    type_score, company_type = calc_company_type_score(name)
    # 排除个体户、工作室、类型不明
    if type_score < 0:
        return None

    industry_score = calc_industry_match(name, biz_type, category)
    distance_score = calc_distance_score(lng, lat, home_coords)
    contact_score = calc_contact_score(poi)
    scale_score = calc_scale_score(name, poi)

    scale_extra = {}
    if deep_mode:
        log(f"    web search: {name[:20]}...")
        scale_extra = search_company_scale(name)
        scale_score = max(scale_score, scale_extra.get("score", scale_score))
        time.sleep(0.5)

    total = (
        type_score * 0.35 +
        scale_score * 0.25 +
        industry_score * 0.20 +
        distance_score * 0.10 +
        contact_score * 0.10
    )

    return {
        "name": name,
        "address": poi.get("address", ""),
        "company_type": company_type,
        "type_score": type_score,
        "scale_score": scale_score,
        "scale_extra": scale_extra,
        "industry_score": industry_score,
        "distance_score": distance_score,
        "contact_score": contact_score,
        "total_score": round(total, 1),
        "phone": poi.get("tel", "") or "",
        "website": poi.get("website", "") or "",
        "category": category,
        "biz_type": biz_type,
        "lng": lng,
        "lat": lat,
    }


def main():
    print("=" * 60)
    print("  Company Finder - Region Search + Smart Scoring")
    print("=" * 60)

    if AMAP_WEB_KEY == "YOUR_AMAP_WEB_API_KEY":
        print("\n[ERROR] Please configure AMap Web API Key first!")
        print("  1. Visit https://lbs.amap.com/ to register")
        print("  2. Console -> App Management -> Create App -> Add Web API Key")
        print("  3. Set AMAP_WEB_KEY in this script\n")
        sys.exit(1)

    deep_mode = "--deep" in sys.argv

    area_file = "area.json"
    for i, arg in enumerate(sys.argv[1:]):
        if arg == "--json" and i + 2 < len(sys.argv):
            area_file = sys.argv[i + 2]

    area_path = Path(area_file)
    if not area_path.exists():
        print(f"\n[ERROR] Area file not found: {area_file}")
        print("  Open map_selector.html in browser -> draw polygon -> download area.json\n")
        sys.exit(1)

    with open(area_path, "r", encoding="utf-8") as f:
        area_data = json.load(f)

    polygon_str = area_data.get("polygon", "")
    if not polygon_str:
        print("[ERROR] area.json: missing 'polygon' field")
        sys.exit(1)

    region_name = area_data.get("name", "Selected Area")
    log(f"Region: {region_name}")
    log(f"Vertices: {area_data.get('vertices', [])}")

    log(f"Geocoding: {MY_ADDRESS}")
    home_coords = geocode(MY_ADDRESS)
    if home_coords:
        log(f"  coords: ({home_coords[0]:.4f}, {home_coords[1]:.4f})")
    else:
        log("  WARNING: geocoding failed, distance scoring uses default")

    log("Searching companies in region...")
    companies = search_all_companies(polygon_str)
    log(f"Found {len(companies)} companies (deduplicated)")

    if not companies:
        print("\nNo matching companies found in this area. Try a larger region.\n")
        sys.exit(0)

    mode_label = "deep (web search)" if deep_mode else "basic"
    log(f"Scoring ({mode_label})...")
    results = []
    excluded = 0
    for i, poi in enumerate(companies):
        if (i + 1) % 20 == 0:
            log(f"  progress: {i+1}/{len(companies)}")
        scored = score_company(poi, home_coords, deep_mode=deep_mode)
        if scored is None:
            excluded += 1
            continue
        results.append(scored)
    if excluded > 0:
        log(f"Excluded {excluded} companies (个体户/工作室/类型不明)")

    results.sort(key=lambda x: x["total_score"], reverse=True)

    # Output CSV
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    date_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = re.sub(r'[\\/:*?"<>|]', '_', region_name)
    csv_path = Path(OUTPUT_DIR) / f"{safe_name}_companies_{date_str}.csv"

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Rank", "Total Score", "Company Name", "Address", "Company Type",
            "Type Score", "Scale Score", "Established Year",
            "Registered Capital", "Scale Info",
            "Industry Match", "Distance Score", "Contact Score",
            "Phone", "Website"
        ])
        for rank, r in enumerate(results, 1):
            scale_info = ""
            se = r.get("scale_extra", {})
            est_year = se.get("established_year", "") if se else ""
            reg_capital = se.get("registered_capital", "") if se else ""

            if se:
                parts = []
                if se.get("employees"):
                    parts.append(f"Employees: {se['employees']}")
                if se.get("has_jobs"):
                    parts.append("Hiring")
                scale_info = "; ".join(parts)

            writer.writerow([
                rank, r["total_score"], r["name"], r["address"],
                r["company_type"], r["type_score"], r["scale_score"],
                est_year, reg_capital, scale_info,
                r["industry_score"], r["distance_score"],
                r["contact_score"], r["phone"], r["website"],
            ])

    # Console summary
    print(f"\n{'='*60}")
    print(f"  Results - {len(results)} companies total")
    print(f"{'='*60}")
    print(f"{'Rank':<5} {'Score':<7} {'Type':<10} {'Company':<28} {'Address'}")
    print("-" * 75)
    for idx, r in enumerate(results[:30], 1):
        print(f"{idx:<5} {r['total_score']:<7.1f} {r['company_type']:<10} "
              f"{r['name'][:27]:<28} {r['address'][:22]}")

    if len(results) > 30:
        print(f"  ... and {len(results)-30} more (see CSV)")

    print(f"\nFull results saved: {csv_path}")
    print(f"Open with Excel/WPS to view all {len(results)} companies\n")


if __name__ == "__main__":
    main()
