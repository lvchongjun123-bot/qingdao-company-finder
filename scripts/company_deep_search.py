#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
company_deep_search.py — 招聘网站深度查询
输入: map_selector.html 导出的 CSV
输出: 补充了 BOSS直聘/智联/前程无忧 信息的 enriched CSV

用法: python company_deep_search.py companies_xxx.csv
"""

import csv
import json
import sys
import time
import re
import os
from urllib.parse import quote

# 青岛城市编码
CITY_CODE_BOSS = '101190200'  # BOSS直聘青岛
CITY_CODE_ZL = '698'          # 智联招聘青岛
CITY_CODE_51 = '370200'       # 前程无忧青岛

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}


def search_boss(company_name):
    """搜索 BOSS 直聘公司信息"""
    results = {'boss_size': '', 'boss_financing': '', 'boss_benefits': '', 'boss_url': ''}

    url = f'https://www.zhipin.com/web/geek/job?query={quote(company_name)}&city={CITY_CODE_BOSS}'
    results['boss_url'] = url

    try:
        import requests
        # 尝试 BOSS 搜索 API
        api_url = 'https://www.zhipin.com/wapi/zpgeek/search/joblist.json'
        params = {
            'query': company_name,
            'city': CITY_CODE_BOSS,
            'page': 1,
            'pageSize': 5
        }
        resp = requests.get(api_url, params=params, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('zpData') and data['zpData'].get('jobList'):
                jobs = data['zpData']['jobList']
                # 提取公司信息
                for job in jobs[:3]:
                    boss = job.get('bossBrand', '') or job.get('brandName', '')
                    if not boss or boss == company_name[:4]:
                        comp = job
                        # 公司规模
                        size = comp.get('brandScaleName', '') or comp.get('scaleName', '')
                        if size and size not in results['boss_size']:
                            results['boss_size'] = size
                        # 融资阶段
                        stage = comp.get('brandStageName', '') or comp.get('stageName', '')
                        if stage and stage not in results['boss_financing']:
                            results['boss_financing'] = stage
                        # 福利标签
                        skills = comp.get('skills', []) or comp.get('benefits', [])
                        if skills:
                            ben = ','.join(skills[:8])
                            if len(ben) > len(results.get('boss_benefits', '')):
                                results['boss_benefits'] = ben
                print(f'  [BOSS] {company_name}: {results["boss_size"]} | {results["boss_financing"]} | {results["boss_benefits"][:40]}')
            else:
                print(f'  [BOSS] {company_name}: 无搜索结果')
    except Exception as e:
        print(f'  [BOSS] {company_name}: 查询失败 ({e})')

    return results


def search_zhilian(company_name):
    """搜索智联招聘公司信息"""
    results = {'zl_size': '', 'zl_type': '', 'zl_url': ''}
    url = f'https://sou.zhaopin.com/?jl={CITY_CODE_ZL}&kw={quote(company_name)}'
    results['zl_url'] = url

    try:
        import requests
        api_url = 'https://fe-api.zhaopin.com/c/i/sou'
        params = {
            'start': 0, 'pageSize': 3,
            'cityId': CITY_CODE_ZL,
            'kw': company_name,
            'workExperience': '-1',
            'education': '-1',
            'companyType': '-1',
            'employmentType': '-1',
            'jobWelfareTag': '-1'
        }
        resp = requests.get(api_url, params=params, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('data') and data['data'].get('results'):
                for job in data['data']['results'][:3]:
                    comp = job.get('company', {})
                    size = comp.get('size', {}).get('name', '')
                    if size and size not in results['zl_size']:
                        results['zl_size'] = size
                    ctype = comp.get('type', {}).get('name', '')
                    if ctype and ctype not in results['zl_type']:
                        results['zl_type'] = ctype
                print(f'  [智联] {company_name}: {results["zl_size"]} | {results["zl_type"]}')
            else:
                print(f'  [智联] {company_name}: 无搜索结果')
    except Exception as e:
        print(f'  [智联] {company_name}: 查询失败 ({e})')

    return results


def search_51job(company_name):
    """搜索前程无忧公司信息"""
    results = {'51_size': '', '51_type': '', '51_url': ''}
    url = f'https://we.51job.com/pc/search?keyword={quote(company_name)}&area={CITY_CODE_51}'
    results['51_url'] = url

    try:
        import requests
        # 前程无忧搜索 API
        api_url = 'https://we.51job.com/api/job/search-pc'
        params = {
            'keyword': company_name,
            'jobArea': CITY_CODE_51,
            'pageNum': 1,
            'pageSize': 3
        }
        resp = requests.post(api_url, json=params, headers={**HEADERS, 'Content-Type': 'application/json'}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            items = data.get('resultbody', {}).get('job', {}).get('items', [])
            if items:
                for item in items[:3]:
                    size = item.get('companySizeText', '') or item.get('companySize', '')
                    if size and size not in results['51_size']:
                        results['51_size'] = size
                    ctype = item.get('companyTypeText', '') or item.get('companyType', '')
                    if ctype and ctype not in results['51_type']:
                        results['51_type'] = ctype
                print(f'  [51job] {company_name}: {results["51_size"]} | {results["51_type"]}')
            else:
                print(f'  [51job] {company_name}: 无搜索结果')
    except Exception as e:
        print(f'  [51job] {company_name}: 查询失败 ({e})')

    return results


def parse_benefits(company_name, all_data):
    """分析福利：从各平台数据推断五险一金、单双休"""
    combined = str(all_data).lower()
    benefits = []

    # 五险一金检测
    if '五险一金' in combined:
        benefits.append('五险一金')
    elif '五险' in combined:
        benefits.append('五险')
    elif '社保' in combined and '公积金' in combined:
        benefits.append('五险一金')
    elif '社保' in combined:
        benefits.append('社保')
    elif '公积金' in combined:
        benefits.append('公积金')

    # 双休检测
    if '双休' in combined:
        benefits.append('双休')
    elif '周末双休' in combined:
        benefits.append('双休')
    elif '单休' in combined or '六天制' in combined:
        benefits.append('单休')
    elif '大小周' in combined:
        benefits.append('大小周')

    # 其他重要福利
    for tag in ['年终奖', '13薪', '14薪', '15薪', '16薪', '股票期权', '补充医疗', '餐补', '房补', '交通补贴']:
        if tag in combined:
            benefits.append(tag)

    return ','.join(benefits) if benefits else ''


def enrich_csv(input_file):
    """读取CSV，逐公司查询招聘网站，输出增强版CSV"""
    if not os.path.exists(input_file):
        print(f'[ERR] File not found: {input_file}')
        sys.exit(1)

    # 读入
    rows = []
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f'[*] Loaded {len(rows)} companies from {input_file}')
    print(f'[*] Will query BOSS直聘 + 智联招聘 + 前程无忧 for each...\n')

    enriched = []
    for i, row in enumerate(rows):
        name = row.get('公司名', '').strip('"')
        print(f'[{i+1}/{len(rows)}] {name}')

        # 查三个平台
        boss = search_boss(name)
        zl = search_zhilian(name)
        wuyi = search_51job(name)

        # 合并
        all_data = {**row, **boss, **zl, **wuyi}

        # 综合福利分析
        all_data['福利分析'] = parse_benefits(name, all_data)

        # 规模信息（取最详细的）
        sizes = [s for s in [boss.get('boss_size', ''), zl.get('zl_size', ''), wuyi.get('51_size', '')] if s]
        all_data['综合规模'] = sizes[0] if sizes else ''

        enriched.append(all_data)

        # 避免被封
        time.sleep(1.5)

    # 输出
    out_file = input_file.replace('.csv', '_enriched.csv')
    if out_file == input_file:
        out_file = 'enriched_' + input_file

    fieldnames = list(rows[0].keys()) + [
        'boss_size', 'boss_financing', 'boss_benefits', 'boss_url',
        'zl_size', 'zl_type', 'zl_url',
        '51_size', '51_type', '51_url',
        '综合规模', '福利分析'
    ]

    with open(out_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for row in enriched:
            writer.writerow(row)

    print(f'\n[OK] Done! Output: {out_file}')
    print(f'    {len(enriched)} companies enriched')

    # 统计
    with_welfare = sum(1 for r in enriched if r.get('福利分析', ''))
    with_size = sum(1 for r in enriched if r.get('综合规模', ''))
    print(f'    有规模数据: {with_size}')
    print(f'    有福利数据: {with_welfare}')

    return out_file


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python company_deep_search.py <exported_csv>')
        print('Example: python company_deep_search.py companies_20260609_1430.csv')
        sys.exit(1)

    enrich_csv(sys.argv[1])
