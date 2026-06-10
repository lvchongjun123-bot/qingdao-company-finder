// ==UserScript==
// @name         高德地图公司发现工具
// @namespace    company-finder
// @version      1.0
// @description  在官方高德地图上圈选区域，搜索公司并智能打分
// @author       Claude
// @match        https://*.amap.com/*
// @match        https://ditu.amap.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ========== 配置 ==========
    const AMAP_WEB_KEY = 'b756c2d47e44c7a36768bd8f2d2d7665';
    const HOME_LNG = 120.141;
    const HOME_LAT = 35.998;

    const SEARCH_KEYWORDS = [
        '科技有限公司','信息技术有限公司','软件有限公司','网络科技有限公司',
        '互联网','大数据','云计算','人工智能','物联网','电子商务','数字科技','智能科技'
    ];

    // ========== 等待地图加载 ==========
    function waitForAMap(cb, tries) {
        tries = tries || 0;
        if (tries > 100) return;
        if (typeof AMap !== 'undefined') { cb(); return; }
        setTimeout(function() { waitForAMap(cb, tries+1); }, 200);
    }

    // ========== 工具函数 ==========
    function haversine(lng1, lat1, lng2, lat2) {
        var R = 6371;
        var dlat = (lat2 - lat1) * Math.PI / 180;
        var dlng = (lng2 - lng1) * Math.PI / 180;
        var a = Math.sin(dlat/2)*Math.sin(dlat/2) +
                Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
                Math.sin(dlng/2)*Math.sin(dlng/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function calcCompanyType(name) {
        if (/外商独资|外国法人独资|外资|外商投资/.test(name)) return [100, '外企独资'];
        if (/中外合资|中外合作/.test(name)) return [95, '中外合资'];
        if (/股份有限公司/.test(name)) return [100, '股份公司'];
        if (/有限责任公司/.test(name)) return [90, '有限公司'];
        if (/有限合伙/.test(name)) return [60, '有限合伙'];
        if (/有限公司/.test(name)) return [85, '有限公司(简)'];
        if (/个体工商户/.test(name)) return [-1, '个体户(排除)'];
        if (/工作室/.test(name)) return [-1, '工作室(排除)'];
        if (/公司|中心|[院院所部]/.test(name)) return [50, '其他机构'];
        return [-1, '类型不明(排除)'];
    }

    function calcIndustry(name, bizType, cat) {
        var text = name + ' ' + (bizType||'') + ' ' + (cat||'');
        var score = 0;
        var matches = ['科技','软件','信息技术','网络','互联网','通信','电子','计算机','自动化','数据'];
        var nonTech = ['餐饮','美容','健身','教育','装修','房产','物流','食品','服装','建材','旅游','酒店'];
        for (var i = 0; i < matches.length; i++) {
            if (text.indexOf(matches[i]) >= 0) score += 15;
        }
        for (var i = 0; i < nonTech.length; i++) {
            if (text.indexOf(nonTech[i]) >= 0) score -= 20;
        }
        return Math.max(0, Math.min(100, score + 30));
    }

    function calcDistance(lng, lat) {
        if (!lng || !lat) return 50;
        var dist = haversine(lng, lat, HOME_LNG, HOME_LAT);
        if (dist <= 7) return 100;
        if (dist <= 10) return 80;
        if (dist <= 15) return 60;
        if (dist <= 20) return 40;
        if (dist <= 30) return 20;
        return 5;
    }

    function calcContact(poi) {
        var score = 0;
        if (poi.tel) score += 50;
        if (poi.website) score += 30;
        if (poi.email) score += 20;
        if (poi.photos && poi.photos.length) score += 10;
        return Math.min(100, score + 20);
    }

    function calcScale(name, poi) {
        var score = 30;
        if (/集团/.test(name)) score += 40;
        if (/分公司|子公司/.test(name)) score += 20;
        if (/连锁/.test(name)) score += 10;
        var bt = poi.biz_type || '';
        var ti = poi.type || '';
        if (/科技|高新|园区/.test(bt)) score += 10;
        if (/商务写字楼|公司企业/.test(ti)) score += 10;
        if (poi.business_area) score += 5;
        return Math.min(100, score);
    }

    function scoreCompany(poi) {
        var name = poi.name || '未知';
        var typeRes = calcCompanyType(name);
        if (typeRes[0] < 0) return null; // 排除

        var lng, lat;
        if (poi.location) {
            var parts = poi.location.split(',');
            lng = parseFloat(parts[0]);
            lat = parseFloat(parts[1]);
        }

        var typeScore = typeRes[0];
        var companyType = typeRes[1];
        var industryScore = calcIndustry(name, poi.biz_type, poi.type);
        var distanceScore = calcDistance(lng, lat);
        var contactScore = calcContact(poi);
        var scaleScore = calcScale(name, poi);

        var total = typeScore * 0.35 + scaleScore * 0.25 + industryScore * 0.20 +
                    distanceScore * 0.10 + contactScore * 0.10;

        return {
            name: name,
            address: poi.address || '',
            companyType: companyType,
            typeScore: typeScore,
            scaleScore: scaleScore,
            industryScore: industryScore,
            distanceScore: distanceScore,
            contactScore: contactScore,
            totalScore: Math.round(total * 10) / 10,
            phone: poi.tel || '',
            distKm: lng ? Math.round(haversine(lng, lat, HOME_LNG, HOME_LAT) * 10) / 10 : '?',
        };
    }

    // ========== API 搜索 ==========
    async function searchPolygon(polygonStr, keyword, page) {
        var url = 'https://restapi.amap.com/v3/place/polygon';
        var params = new URLSearchParams({
            key: AMAP_WEB_KEY,
            polygon: polygonStr,
            keywords: keyword,
            offset: 20,
            page: page || 1,
            extensions: 'all',
            output: 'JSON'
        });
        try {
            var resp = await fetch(url + '?' + params.toString());
            return await resp.json();
        } catch(e) {
            return null;
        }
    }

    async function searchAllCompanies(polygonStr, progressCb) {
        var allResults = {};
        var seen = {};
        for (var ki = 0; ki < SEARCH_KEYWORDS.length; ki++) {
            var kw = SEARCH_KEYWORDS[ki];
            if (progressCb) progressCb('搜索: ' + kw + ' (' + (ki+1) + '/' + SEARCH_KEYWORDS.length + ')');
            var page = 1;
            while (true) {
                var data = await searchPolygon(polygonStr, kw, page);
                if (!data || data.status !== '1') break;
                var pois = data.pois || [];
                if (!pois.length) break;
                for (var i = 0; i < pois.length; i++) {
                    var poi = pois[i];
                    var key = poi.name + '|' + (poi.address || '');
                    if (!seen[key]) {
                        seen[key] = true;
                        allResults[key] = poi;
                    }
                }
                var total = parseInt(data.count) || 0;
                if (page * 20 >= Math.min(total, 900)) break;
                page++;
                await new Promise(function(r) { setTimeout(r, 200); });
            }
        }
        return Object.values(allResults);
    }

    // ========== UI ==========
    function createUI(mapInstance) {
        // 移除旧UI
        var old = document.getElementById('cf_toolbar');
        if (old) old.remove();
        old = document.getElementById('cf_panel');
        if (old) old.remove();

        // 工具栏
        var toolbar = document.createElement('div');
        toolbar.id = 'cf_toolbar';
        toolbar.innerHTML = `
            <button id="cf_btn_draw">圈选区域</button>
            <button id="cf_btn_export" disabled>导出CSV</button>
            <button id="cf_btn_clear">清除</button>
            <span id="cf_status" style="margin-left:10px;font-size:13px;color:#666;"></span>
        `;
        toolbar.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;'
            + 'display:flex;gap:8px;align-items:center;background:rgba(255,255,255,0.95);'
            + 'padding:8px 16px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);';
        document.body.appendChild(toolbar);

        // 结果面板
        var panel = document.createElement('div');
        panel.id = 'cf_panel';
        panel.innerHTML = '<div id="cf_results"><p style="color:#999;text-align:center;padding:40px 0;">画完区域后自动显示结果</p></div>';
        panel.style.cssText = 'position:fixed;right:10px;top:70px;bottom:10px;width:360px;z-index:99998;'
            + 'background:rgba(255,255,255,0.95);border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);'
            + 'overflow-y:auto;font-size:13px;';
        document.body.appendChild(panel);

        // 绑定事件
        var mouseTool = null;
        var polygon = null;
        var polygonPath = [];
        var allResults = [];

        // 加载 MouseTool
        AMap.plugin('AMap.MouseTool', function() {
            mouseTool = new AMap.MouseTool(mapInstance);
        });

        document.getElementById('cf_btn_draw').onclick = function() {
            if (!mouseTool) { alert('正在加载绘图工具，请稍后再点'); return; }
            if (polygon) { mapInstance.remove(polygon); polygon = null; }
            polygonPath = [];
            mouseTool.polygon();
            this.textContent = '绘制中...点击地图描点';
            document.getElementById('cf_status').textContent = '';

            mouseTool.on('draw', async function(e) {
                polygon = e.obj;
                mapInstance.add(polygon);
                mapInstance.setFitView([polygon]);
                polygonPath = polygon.getPath().map(function(p) { return [p.lng, p.lat]; });
                document.getElementById('cf_btn_draw').textContent = '重新圈选';
                document.getElementById('cf_btn_export').disabled = true;

                var polyStr = polygonPath.map(function(p) { return p.join(','); }).join('|');
                var panelEl = document.getElementById('cf_results');
                panelEl.innerHTML = '<p style="text-align:center;padding:20px;color:#0091ff;">正在搜索公司...</p>';

                var companies = await searchAllCompanies(polyStr, function(msg) {
                    document.getElementById('cf_status').textContent = msg;
                });

                // 打分排序
                var results = [];
                var excluded = 0;
                for (var i = 0; i < companies.length; i++) {
                    var scored = scoreCompany(companies[i]);
                    if (scored === null) { excluded++; continue; }
                    results.push(scored);
                }
                results.sort(function(a, b) { return b.totalScore - a.totalScore; });
                allResults = results;

                document.getElementById('cf_status').textContent = '共 ' + results.length + ' 家公司（排除' + excluded + '家个体户/工作室）';
                document.getElementById('cf_btn_export').disabled = false;

                // 渲染结果
                renderResults(results, panelEl);
            });
        };

        document.getElementById('cf_btn_clear').onclick = function() {
            if (polygon) { mapInstance.remove(polygon); polygon = null; }
            polygonPath = [];
            allResults = [];
            document.getElementById('cf_btn_draw').textContent = '圈选区域';
            document.getElementById('cf_btn_export').disabled = true;
            document.getElementById('cf_status').textContent = '';
            document.getElementById('cf_results').innerHTML = '<p style="color:#999;text-align:center;padding:40px 0;">画完区域后自动显示结果</p>';
        };

        document.getElementById('cf_btn_export').onclick = function() {
            if (!allResults.length) return;
            var csv = '排名,综合评分,公司名称,地址,企业类型,类型评分,规模评分,行业匹配,距离(km),距离评分,联系方式分,电话\n';
            for (var i = 0; i < allResults.length; i++) {
                var r = allResults[i];
                csv += [i+1, r.totalScore, '"'+r.name+'"', '"'+r.address+'"', r.companyType,
                        r.typeScore, r.scaleScore, r.industryScore, r.distKm,
                        r.distanceScore, r.contactScore, r.phone].join(',') + '\n';
            }
            var blob = new Blob(['﻿' + csv], {type: 'text/csv;charset=utf-8'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = '公司列表_' + new Date().toISOString().slice(0,10) + '.csv';
            a.click();
            URL.revokeObjectURL(url);
        };
    }

    function renderResults(results, container) {
        if (!results.length) {
            container.innerHTML = '<p style="color:#999;text-align:center;padding:40px 0;">该区域未找到匹配公司</p>';
            return;
        }
        var html = '<div style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">找到 <span style="color:#0091ff;">' + results.length + '</span> 家公司</div>';
        var showCount = Math.min(results.length, 50);
        for (var i = 0; i < showCount; i++) {
            var r = results[i];
            var bg = r.totalScore >= 70 ? '#e8f5e9' : (r.totalScore >= 55 ? '#fffde7' : '#fafafa');
            var badge = r.totalScore >= 70 ? 'green' : (r.totalScore >= 55 ? '#f9a825' : '#999');
            html += '<div style="padding:10px 12px;border-bottom:1px solid #f0f0f0;background:' + bg + ';">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;">'
                + '<strong style="font-size:14px;">' + (i+1) + '. ' + r.name + '</strong>'
                + '<span style="background:' + badge + ';color:#fff;padding:2px 8px;border-radius:10px;font-weight:bold;">' + r.totalScore + '</span>'
                + '</div>'
                + '<div style="color:#666;font-size:12px;margin-top:4px;">' + r.address + '</div>'
                + '<div style="display:flex;gap:8px;margin-top:4px;font-size:11px;color:#888;">'
                + '<span>' + r.companyType + '</span>'
                + '<span>距离:' + r.distKm + 'km</span>'
                + (r.phone ? '<span>电话:' + r.phone + '</span>' : '')
                + '</div></div>';
        }
        if (results.length > 50) {
            html += '<p style="text-align:center;color:#999;padding:10px;">还有 ' + (results.length-50) + ' 家公司（导出CSV查看全部）</p>';
        }
        container.innerHTML = html;
    }

    // ========== 启动 ==========
    waitForAMap(function() {
        // 获取页面现有的地图实例比较困难，我们创建一个覆盖层
        var mapDiv = document.createElement('div');
        mapDiv.id = 'cf_map';
        mapDiv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99990;background:#f0f0f0;';
        document.body.appendChild(mapDiv);

        // 添加关闭按钮
        var closeBtn = document.createElement('button');
        closeBtn.textContent = 'X 关闭工具';
        closeBtn.style.cssText = 'position:fixed;top:12px;right:16px;z-index:99999;padding:6px 14px;'
            + 'border:none;border-radius:4px;background:#ff5252;color:#fff;font-size:13px;cursor:pointer;';
        closeBtn.onclick = function() {
            var els = ['cf_map', 'cf_toolbar', 'cf_panel'];
            for (var i = 0; i < els.length; i++) {
                var el = document.getElementById(els[i]);
                if (el) el.remove();
            }
            var cb = document.getElementById('cf_close');
            if (cb) cb.remove();
        };
        closeBtn.id = 'cf_close';
        document.body.appendChild(closeBtn);

        // 创建地图
        var map = new AMap.Map('cf_map', {
            zoom: 13,
            center: [120.13, 36.02],
            mapStyle: 'amap://styles/normal'
        });

        // 标记家位置
        var homeMarker = new AMap.Marker({
            position: [HOME_LNG, HOME_LAT],
            title: '学院路288号'
        });
        homeMarker.setLabel({ content: '我的位置', offset: new AMap.Pixel(0, -25) });
        map.add(homeMarker);

        createUI(map);
    });

})();
