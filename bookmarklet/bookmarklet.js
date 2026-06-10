/**
 * 区域公司打分 - Bookmarklet
 *
 * 在 amap.com 上注入区域搜索功能：
 *   点书签 → 页面出现蓝色搜索圈 → 拖动/缩放地图 → 点搜索 → 区域内公司自动打分
 *
 * 原理：复用 amap.com 已有的高德地图实例，添加 searchNearBy 圆形搜索
 */
(function(){
if(window.__CF)return;window.__CF=true;

var HOME='青岛市黄岛区学院路288号',HLNG=120.141,HLAT=35.998;
var KEYS=['科技有限公司','信息技术有限公司','软件有限公司','网络科技有限公司',
  '互联网','大数据','云计算','人工智能','物联网','电子商务','数字科技','智能科技'];
var MATCH=['科技','软件','信息技术','网络','互联网','通信','电子','计算机','自动化','数据'];

// ========== 找到 amap.com 的地图实例 ==========
var AMapInstance = window.AMap;
if(!AMapInstance){
  alert('请在 amap.com 页面使用此书签');
  return;
}

// 暴力扫描：查找所有对象中像地图实例的
var map = null;

// 方法1: 扫描所有 div 的 __map 属性
var divs = document.querySelectorAll('div');
for(var i=0;i<divs.length;i++){
  if(divs[i].__map && divs[i].__map.getCenter){
    map = divs[i].__map; break;
  }
}

// 方法2a: 直接检测常见全局变量名（新版 amap.com 用 window.themap）
if(!map && window.themap && window.themap.getCenter && window.themap.getZoom() > 0){
  map = window.themap;
}

// 方法2b: 扫描 window 下的全局变量
if(!map){
  var keys = Object.keys(window);
  for(var i=0;i<keys.length;i++){
    try{
      var v = window[keys[i]];
      if(v && typeof v === 'object' && v.getCenter && v.setZoom && v.getZoom() > 0){
        map = v; break;
      }
    }catch(e){}
  }
}

// 方法3: 查找 AMap 命名空间下的实例
if(!map && AMapInstance._maps){
  var mks = Object.keys(AMapInstance._maps);
  if(mks.length > 0) map = AMapInstance._maps[mks[0]];
}

// 方法4: 实在找不到，创建一个隐藏的地图实例用于搜索
if(!map){
  var container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px';
  document.body.appendChild(container);
  map = new AMapInstance.Map(container, {
    zoom: 13, center: [120.141, 35.998]
  });
}

// ========== 注入 CSS ==========
var css=document.createElement('style');
css.textContent=[
  '#cf-bar{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;',
  'display:flex;gap:8px;align-items:center;background:#fff;padding:8px 14px;',
  'border-radius:8px;box-shadow:0 2px 16px rgba(0,0,0,.15);font:13px "Microsoft YaHei",sans-serif}',
  '#cf-bar button{padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;white-space:nowrap}',
  '.cf-go{background:#1677ff;color:#fff;font-size:15px!important}.cf-go.on{background:#faad14}',
  '.cf-r{background:#fff;color:#333;border:1px solid #e0e0e0!important;font-size:12px!important;padding:6px 10px!important}',
  '.cf-r.sel{background:#1677ff;color:#fff;border-color:#1677ff!important}',
  '.cf-out{background:#52c41a;color:#fff}.cf-out:disabled{background:#e8e8e8;color:#bbb}',
  '#cf-msg{position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;',
  'background:rgba(255,255,255,.95);color:#333;padding:8px 20px;border-radius:20px;',
  'font:13px "Microsoft YaHei",sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.12);pointer-events:none}',
  '#cf-pnl{position:fixed;top:56px;right:10px;z-index:99999;width:440px;',
  'max-height:calc(100vh-66px);background:rgba(255,255,255,.97);border:1px solid #e0e0e0;',
  'border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.12);display:none;flex-direction:column;',
  'font:13px "Microsoft YaHei",sans-serif;color:#333;overflow:hidden}',
  '#cf-pnl .ph{padding:10px 14px;border-bottom:1px solid #f0f0f0;display:flex;',
  'justify-content:space-between;align-items:center;flex-shrink:0;background:#fafafa}',
  '#cf-pnl .ph strong{color:#1677ff;font-size:14px}',
  '#cf-pnl .pb{overflow-y:auto;flex:1;padding:8px}',
  '.cf-prog{background:#f0f0f0;border-radius:4px;height:6px;margin:8px 0}',
  '.cf-prog div{background:#1677ff;height:100%;border-radius:4px;width:0;transition:width .3s}',
  '.cf-pt{font-size:12px;color:#999}',
  '.cf-row{background:#fafafa;border:1px solid #f0f0f0;border-left:3px solid transparent;',
  'border-radius:6px;padding:8px;margin-bottom:4px;cursor:pointer}',
  '.cf-row:hover{background:#f0f5ff}.cf-row.h{border-left-color:#52c41a}',
  '.cf-row.m{border-left-color:#faad14}.cf-row.l{border-left-color:#ff4d4f}',
  '.cf-t{display:flex;justify-content:space-between}',
  '.cf-n{font-weight:bold;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.cf-s{font-size:15px;font-weight:bold}.cf-s.h{color:#52c41a}.cf-s.m{color:#faad14}.cf-s.l{color:#ff4d4f}',
  '.cf-m{display:flex;gap:6px;margin-top:2px;font-size:10px;color:#999}',
  '.cf-a{font-size:10px;color:#999;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.cf-d{display:none;margin-top:5px;padding-top:5px;border-top:1px solid #f0f0f0;font-size:10px;color:#666}',
  '.cf-d td{padding:1px 3px}.cf-d td:last-child{text-align:right}'
].join('\n');
document.head.appendChild(css);

// ========== 注入 UI ==========
var bar=document.createElement('div');bar.id='cf-bar';
bar.innerHTML=[
  '<button class="cf-go" id="cfGo">搜索区域内公司</button>',
  '<button class="cf-r sel" data-r="3">3km</button>',
  '<button class="cf-r" data-r="5">5km</button>',
  '<button class="cf-r" data-r="7">7km</button>',
  '<button class="cf-r" data-r="10">10km</button>',
  '<button class="cf-out" id="cfOut" disabled>导出CSV</button>'
].join('');
document.body.appendChild(bar);

var msg=document.createElement('div');msg.id='cf-msg';
msg.textContent='拖动地图或点击来移动搜索中心，蓝圈为搜索范围';
document.body.appendChild(msg);

var pnl=document.createElement('div');pnl.id='cf-pnl';
pnl.innerHTML=[
  '<div class="ph"><strong id="cfTitle">结果 0 家</strong>',
  '<button style="background:#e8e8e8;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:11px" id="cfToggle">收起</button></div>',
  '<div class="pb" id="cfBody">',
  '<div class="cf-prog" id="cfProgWrap" style="display:none"><div id="cfProgFill"></div></div>',
  '<div class="cf-pt" id="cfProgText"></div>',
  '<div id="cfList"></div></div>'
].join('');
document.body.appendChild(pnl);

// ========== 搜索圆 ==========
var radius=3000; // 默认3km
var center={lng:map.getCenter().lng,lat:map.getCenter().lat};

var circle=new AMapInstance.Circle({
  center:[center.lng,center.lat],radius:radius,
  strokeColor:'#1677ff',strokeWeight:3,strokeOpacity:.7,
  fillColor:'#1677ff',fillOpacity:.08,zIndex:100
});
circle.setMap(map);

var cm=new AMapInstance.Marker({
  position:[center.lng,center.lat],
  label:{content:'<div style="background:#1677ff;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;white-space:nowrap">搜这里</div>',offset:new AMapInstance.Pixel(-25,-30)},
  zIndex:101
});
cm.setMap(map);

function updateCircle(){
  circle.setCenter([center.lng,center.lat]);
  circle.setRadius(radius);
  cm.setPosition([center.lng,center.lat]);
}

// 监听地图移动(用户拖动/缩放时更新圆心)
map.on('moveend',function(){
  var c=map.getCenter();
  center.lng=c.lng;center.lat=c.lat;
  updateCircle();
});

// 点击精确设中心
map.on('click',function(e){
  if(isSearching)return;
  center.lng=e.lnglat.getLng();
  center.lat=e.lnglat.getLat();
  updateCircle();
  msg.textContent='搜索中心: '+center.lng.toFixed(4)+', '+center.lat.toFixed(4)+'  半径: '+(radius/1000)+'km';
});

// 半径按钮
document.getElementById('cf-bar').addEventListener('click',function(e){
  if(e.target.classList.contains('cf-r')&&!isSearching){
    var btns=this.querySelectorAll('.cf-r');
    for(var i=0;i<btns.length;i++)btns[i].classList.remove('sel');
    e.target.classList.add('sel');
    radius=parseInt(e.target.dataset.r)*1000;
    updateCircle();
    msg.textContent='半径: '+(radius/1000)+'km  拖动地图或点击来移动搜索中心';
  }
});

// 收起面板
document.getElementById('cfToggle').onclick=function(){
  var b=document.getElementById('cfBody');
  b.style.display=b.style.display==='none'?'block':'none';
  this.textContent=b.style.display==='none'?'展开':'收起';
};

// ========== 打分 ==========
function dist(l1,t1,l2,t2){
  var R=6371,a=(t2-t1)*Math.PI/180,b=(l2-l1)*Math.PI/180;
  var c=Math.sin(a/2)*Math.sin(a/2)+Math.cos(t1*Math.PI/180)*Math.cos(t2*Math.PI/180)*Math.sin(b/2)*Math.sin(b/2);
  return R*2*Math.atan2(Math.sqrt(c),Math.sqrt(1-c));
}

function score(p){
  // 归一化 REST API 数据：某些字段可能是数组而非字符串
  var n=(typeof p.name==='string')?p.name:'';
  var b=(typeof p.biz_type==='string')?p.biz_type:(Array.isArray(p.biz_type)?p.biz_type.join(' '):'');
  var c=(typeof p.type==='string')?p.type:(Array.isArray(p.type)?p.type.join(' '):'');
  var tel=(typeof p.tel==='string')?p.tel:(Array.isArray(p.tel)&&p.tel.length>0?String(p.tel[0]):'');
  var web=(typeof p.website==='string')?p.website:(Array.isArray(p.website)&&p.website.length>0?String(p.website[0]):'');
  var email=(typeof p.email==='string')?p.email:(Array.isArray(p.email)&&p.email.length>0?String(p.email[0]):'');
  var addr=(typeof p.address==='string')?p.address:(Array.isArray(p.address)&&p.address.length>0?String(p.address[0]):'');
  var pname=(typeof p.pname==='string')?p.pname:(Array.isArray(p.pname)&&p.pname.length>0?String(p.pname[0]):'');
  var rt='';
  if(p.biz_ext&&p.biz_ext.rating){
    rt=(typeof p.biz_ext.rating==='string')?p.biz_ext.rating:(Array.isArray(p.biz_ext.rating)?'':String(p.biz_ext.rating||''));
  }
  // REST API 返回 "lng,lat" 字符串，JS API 返回 {lng,lat} 对象，统一处理
  var lng=null,lat=null;
  if(p.location){
    if(typeof p.location==='string'){
      var parts=p.location.split(',');
      lng=parseFloat(parts[0]);lat=parseFloat(parts[1]);
    }else{lng=p.location.lng;lat=p.location.lat;}
  }
  var ts,ct;
  if(/外商独资|外国法人独资|外资|外商投资/.test(n)){ts=100;ct='外企独资'}
  else if(/中外合资|中外合作/.test(n)){ts=95;ct='中外合资'}
  else if(/股份有限公司/.test(n)){ts=100;ct='股份公司'}
  else if(/有限责任公司/.test(n)){ts=90;ct='有限公司'}
  else if(/有限合伙/.test(n)){ts=60;ct='有限合伙'}
  else if(/有限公司/.test(n)){ts=85;ct='有限公司'}
  else if(/个体工商户/.test(n)||/工作室/.test(n))return null;
  else if(/公司|中心|院|所|部/.test(n)){ts=50;ct='其他'}
  else return null;

  var t=(n+' '+b+' '+c).toLowerCase(),ind=0;
  for(var i=0;i<MATCH.length;i++)if(t.indexOf(MATCH[i].toLowerCase())>=0)ind+=15;
  var bad=['餐饮','美容','健身','教育','装修','房产','物流','食品','服装','建材','旅游','酒店'];
  for(var j=0;j<bad.length;j++)if(t.indexOf(bad[j].toLowerCase())>=0)ind-=20;
  ind=Math.max(0,Math.min(100,ind+30));

  var ds=50;if(lng&&lat){
    var d=dist(lng,lat,HLNG,HLAT);
    if(d<=7)ds=100;else if(d<=10)ds=80;else if(d<=15)ds=60;else if(d<=20)ds=40;else if(d<=30)ds=20;else ds=5;
  }
  var cs=0;if(tel)cs+=50;if(web)cs+=30;if(email)cs+=20;cs=Math.min(100,cs+20);
  var ss=30;if(/集团/.test(n))ss+=40;if(/分公司|子公司/.test(n))ss+=20;if(/连锁/.test(n))ss+=10;
  if(/科技|高新|园区/.test(b))ss+=10;if(/商务写字楼|公司企业/.test(c))ss+=10;if(p.business_area)ss+=5;
  if(rt){var f=parseFloat(rt);if(f>4)ss+=10;else if(f>3)ss+=5;}
  ss=Math.min(100,ss);
  var total=ts*.35+ss*.25+ind*.20+ds*.10+cs*.10;
  var dst=lng&&lat?dist(lng,lat,HLNG,HLAT):null;
  return{name:n,address:addr||pname||'',companyType:ct,typeScore:ts,
    scaleScore:ss,industryScore:ind,distanceScore:ds,contactScore:cs,
    total:Math.round(total*10)/10,phone:tel||'',lng:lng,lat:lat,distance:dst};
}

// ========== 搜索 (REST API) ==========
var isSearching=false,allResults=[];
var WS_KEY='b756c2d47e44c7a36768bd8f2d2d7665';  // 高德 Web 服务 Key
var API_BASE='https:'+'//restapi.amap.com/v3/place/around';  // 拼接避免压缩工具误删

document.getElementById('cfGo').onclick=function(){
  if(isSearching)return;
  isSearching=true;
  allResults=[];
  var btn=this;btn.textContent='搜索中...';btn.classList.add('on');
  pnl.style.display='flex';
  document.getElementById('cfList').innerHTML='';
  document.getElementById('cfTitle').textContent='结果 0 家';
  document.getElementById('cfProgWrap').style.display='block';
  document.getElementById('cfProgFill').style.width='0%';
  document.getElementById('cfProgText').textContent='REST API 搜索...';
  document.getElementById('cfOut').disabled=true;

  var all=[],seen={},kwIdx=0,page=1,totalPages=0;
  var MAX_PAGES=8,PAGE_SIZE=25,DELAY=300;

  function fetchNext(){
    if(kwIdx>=KEYS.length){finish(all);return;}
    var kw=KEYS[kwIdx];
    var url=API_BASE+'?key='+WS_KEY+
      '&location='+center.lng.toFixed(6)+','+center.lat.toFixed(6)+
      '&radius='+radius+'&keywords='+encodeURIComponent(kw)+
      '&offset='+PAGE_SIZE+'&page='+page+'&extensions=all';

    fetch(url).then(function(r){return r.json();}).then(function(data){
      if(data.status==='1'&&data.pois){
        data.pois.forEach(function(poi){
          var k=poi.name+'|'+(poi.address||'');
          if(!seen[k]){seen[k]=true;all.push(poi);}
        });
        if(page===1){
          var cnt=parseInt(data.count)||0;
          totalPages=Math.min(Math.ceil(cnt/PAGE_SIZE),MAX_PAGES);
        }
      }
      page++;
      if(page>totalPages){kwIdx++;page=1;totalPages=0;}

      var pct=Math.round(kwIdx/KEYS.length*100);
      document.getElementById('cfProgFill').style.width=pct+'%';
      document.getElementById('cfProgText').textContent=kwIdx+'/'+KEYS.length+' 关键词 '+all.length+'家';
      msg.textContent='['+(kwIdx+1)+'/'+KEYS.length+'] '+kw+' p'+(page-1)+' ['+all.length+'家]';

      setTimeout(fetchNext,DELAY);
    }).catch(function(err){
      console.log('REST err:',err.message);
      page++;
      if(page>totalPages){kwIdx++;page=1;totalPages=0;}
      setTimeout(fetchNext,DELAY);
    });
  }
  fetchNext();
};

function finish(all){
  isSearching=false;
  document.getElementById('cfProgWrap').style.display='none';
  document.getElementById('cfProgText').textContent='';
  var btn=document.getElementById('cfGo');
  btn.textContent='搜索区域内公司';btn.classList.remove('on');

  msg.textContent='打分中...';
  var scored=[],ex=0;
  for(var i=0;i<all.length;i++){
    var s=score(all[i]);
    if(!s){ex++;continue;}
    scored.push(s);
  }
  scored.sort(function(a,b){return b.total-a.total;});
  allResults=scored;
  render(scored);

  if(scored.length){
    document.getElementById('cfOut').disabled=false;
    msg.textContent='[OK] '+scored.length+' 家公司 (排除'+ex+'家个体户/工作室)';
  }else{
    msg.textContent='未找到公司，请扩大半径或换个区域';
  }
}

function render(results){
  var h='';
  if(!results.length)h='<div style="text-align:center;padding:30px;color:#999">该区域未找到公司<br>试试扩大半径</div>';
  for(var i=0;i<results.length;i++){
    var r=results[i],cls=r.total>=70?'h':(r.total>=50?'m':'l');
    var dst=r.distance!==null?r.distance.toFixed(1)+' km':'--';
    h+='<div class="cf-row '+cls+'" onclick="var e=this.querySelector(\'.cf-d\');e.style.display=e.style.display==\'block\'?\'none\':\'block\'">'+
      '<div class="cf-t"><span class="cf-n" title="'+esc(r.name)+'">'+(i+1)+'. '+esc(r.name)+'</span>'+
      '<span class="cf-s '+cls+'">'+r.total+'</span></div>'+
      '<div class="cf-m"><span>'+r.companyType+'</span><span>类型'+r.typeScore+'</span>'+
      '<span>规模'+r.scaleScore+'</span><span>行业'+r.industryScore+'</span><span>距离'+r.distanceScore+'</span></div>'+
      '<div class="cf-a">'+esc(r.address)+' | '+dst+'</div>'+
      '<div class="cf-d"><table>'+
      '<tr><td>类型</td><td>'+r.typeScore+' ('+r.companyType+')</td></tr>'+
      '<tr><td>规模</td><td>'+r.scaleScore+'</td></tr>'+
      '<tr><td>行业</td><td>'+r.industryScore+'</td></tr>'+
      '<tr><td>距离</td><td>'+r.distanceScore+'</td></tr>'+
      '<tr><td>电话</td><td>'+(r.phone||'--')+'</td></tr></table></div></div>';
  }
  document.getElementById('cfList').innerHTML=h;
  document.getElementById('cfTitle').textContent='结果 '+results.length+' 家';
}

// ========== CSV ==========
document.getElementById('cfOut').onclick=function(){
  if(!allResults.length)return;
  var rows=['﻿排名,总分,公司名,地址,公司类型,类型分,规模分,行业匹配,距离分,联系方式分,距离(km),电话'];
  for(var i=0;i<allResults.length;i++){
    var r=allResults[i];
    rows.push([i+1,r.total,'"'+(r.name||'').replace(/"/g,'""')+'"',
      '"'+(r.address||'').replace(/"/g,'""')+'"',
      r.companyType,r.typeScore,r.scaleScore,r.industryScore,r.distanceScore,r.contactScore,
      r.distance!==null?r.distance.toFixed(1):'',r.phone||''].join(','));
  }
  var b=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  var n=new Date();
  a.download='companies_'+n.getFullYear()+('0'+(n.getMonth()+1)).slice(-2)+('0'+n.getDate()).slice(-2)+'_'+('0'+n.getHours()).slice(-2)+('0'+n.getMinutes()).slice(-2)+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  msg.textContent='[OK] CSV导出: '+allResults.length+' 家';
};

function esc(s){return s?s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):'';}

msg.textContent='[OK] 已激活！蓝圈=搜索范围，拖动地图或点击移动中心，选好半径后点上方按钮搜索';

})();
