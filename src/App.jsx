import { useState, useRef } from "react";
import { useEffect, useCallback, createContext, useContext } from "react";

// ═══════════════════════════════════════════════════════════════
//  API LAYER — connects frontend to backend REST API
//  Falls back to in-memory data when API is not configured
// ═══════════════════════════════════════════════════════════════

var API_CONFIG_KEY = "hrcloud_api_config";

function getStoredApiConfig() {
  try {
    var raw = window.__hrcloudApiConfig;
    if (raw) return raw;
  } catch(e) {}
  return { baseUrl: "", enabled: false };
}

var _apiConfig = getStoredApiConfig();
var _accessToken = null;
var _refreshToken = null;

function setApiConfig(cfg) {
  _apiConfig = cfg;
  window.__hrcloudApiConfig = cfg;
}

function setTokens(access, refresh) {
  _accessToken  = access;
  _refreshToken = refresh;
}

function clearTokens() {
  _accessToken  = null;
  _refreshToken = null;
}

async function apiRequest(method, path, body, skipAuth) {
  if (!_apiConfig.enabled || !_apiConfig.baseUrl) return null;
  var url = _apiConfig.baseUrl.replace(/\/$/, "") + path;
  var headers = { "Content-Type": "application/json" };
  if (!skipAuth && _accessToken) headers["Authorization"] = "Bearer " + _accessToken;
  try {
    var res = await fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && _refreshToken && !skipAuth) {
      // Try refresh
      var rr = await fetch(_apiConfig.baseUrl.replace(/\/$/, "") + "/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: _refreshToken }),
      });
      if (rr.ok) {
        var rd = await rr.json();
        setTokens(rd.accessToken, rd.refreshToken);
        headers["Authorization"] = "Bearer " + rd.accessToken;
        res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      }
    }
    if (!res.ok) {
      var errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "API error " + res.status);
    }
    return await res.json();
  } catch(e) {
    console.warn("[API]", method, path, e.message);
    return null;
  }
}

var api = {
  get:    function(path)        { return apiRequest("GET",    path); },
  post:   function(path, body)  { return apiRequest("POST",   path, body); },
  put:    function(path, body)  { return apiRequest("PUT",    path, body); },
  delete: function(path)        { return apiRequest("DELETE", path); },

  // Auth
  login: async function(loginMode, loginId, password, companyId) {
    return apiRequest("POST", "/auth/login", { loginMode, loginId, password, companyId }, true);
  },
  logout: async function() {
    var r = await apiRequest("POST", "/auth/logout");
    clearTokens();
    return r;
  },
  me: function() { return apiRequest("GET", "/auth/me"); },

  // Employees
  getEmployees:   function(params) {
    var qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiRequest("GET", "/employees" + qs);
  },
  getEmployee:    function(id)     { return apiRequest("GET",    "/employees/" + id); },
  createEmployee: function(data)   { return apiRequest("POST",   "/employees", data); },
  updateEmployee: function(id, d)  { return apiRequest("PUT",    "/employees/" + id, d); },
  deleteEmployee: function(id)     { return apiRequest("DELETE", "/employees/" + id); },

  // Payroll
  getBatches:    function()         { return apiRequest("GET",  "/payroll/batches"); },
  getBatch:      function(id)       { return apiRequest("GET",  "/payroll/batches/" + id); },
  createBatch:   function(d)        { return apiRequest("POST", "/payroll/batches", d); },
  saveLines:     function(id, lines){ return apiRequest("PUT",  "/payroll/batches/" + id + "/lines", { lines }); },
  confirmBatch:  function(id)       { return apiRequest("POST", "/payroll/batches/" + id + "/confirm"); },
  payBatch:      function(id)       { return apiRequest("POST", "/payroll/batches/" + id + "/pay"); },
  getPayslips:   function(empId)    { return apiRequest("GET",  "/payroll/employee/" + empId); },

  // Leave
  getLeaves:     function(params) {
    var qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiRequest("GET", "/leave" + qs);
  },
  applyLeave:    function(d)     { return apiRequest("POST", "/leave", d); },
  approveLeave:  function(id, note) { return apiRequest("PUT", "/leave/" + id + "/approve", { note }); },
  rejectLeave:   function(id, note) { return apiRequest("PUT", "/leave/" + id + "/reject",  { note }); },
  cancelLeave:   function(id)    { return apiRequest("PUT", "/leave/" + id + "/cancel"); },
  getLeaveBalance: function(empId, year) { return apiRequest("GET", "/leave/balance/" + empId + "?year=" + (year || "")); },
  getLeaveTypes: function()      { return apiRequest("GET", "/leave/types"); },
  getHolidays:   function(year)  { return apiRequest("GET", "/leave/holidays?year=" + (year || "")); },

  // Attendance
  getAttendance: function(params) {
    var qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiRequest("GET", "/attendance" + qs);
  },
  punch:         function(d)     { return apiRequest("POST", "/attendance/punch", d); },
  overrideAtt:   function(id, d) { return apiRequest("PUT",  "/attendance/" + id + "/override", d); },
  bulkAttendance:function(recs)  { return apiRequest("POST", "/attendance/bulk", { records: recs }); },
  getAttSummary: function(empId, month) { return apiRequest("GET", "/attendance/summary/" + empId + "?month=" + (month||"")); },

  // Schedules
  getShifts:       function()      { return apiRequest("GET", "/schedules/shifts"); },
  saveShifts:      function(shifts){ return apiRequest("PUT", "/schedules/shifts", { shifts }); },
  getEmpSchedule:  function(empId) { return apiRequest("GET", "/schedules/employee/" + empId); },
  saveEmpSchedule: function(empId, schedule, effectiveFrom) { return apiRequest("PUT", "/schedules/employee/" + empId, { schedule, effectiveFrom }); },
  getUnifiedSched: function()      { return apiRequest("GET", "/schedules/unified"); },
  saveUnifiedSched:function(sched) { return apiRequest("PUT", "/schedules/unified", { schedule: sched }); },

  // Reports
  getDashboard:      function() { return apiRequest("GET", "/reports/dashboard"); },
  getPayrollTrend:   function(months) { return apiRequest("GET", "/reports/payroll-trend?months=" + (months||6)); },
  getLeaveSummary:   function(year)   { return apiRequest("GET", "/reports/leave-summary?year=" + (year||"")); },
  getAttMonthly:     function(month)  { return apiRequest("GET", "/reports/attendance-monthly?month=" + (month||"")); },
  getHeadcountDept:  function()       { return apiRequest("GET", "/reports/headcount-by-dept"); },

  // Statutory
  getStatutorySummary: function(batchId) { return apiRequest("GET", "/statutory/summary?batchId=" + batchId); },
  getEAData:           function(year)    { return apiRequest("GET", "/statutory/ea?year=" + (year||"")); },

  // Platform
  getPlatformDashboard: function()         { return apiRequest("GET",    "/platform/dashboard"); },
  getPlatformAdmins:    function()         { return apiRequest("GET",    "/platform/admins"); },
  addPlatformAdmin:     function(d)        { return apiRequest("POST",   "/platform/admins", d); },
  removePlatformAdmin:  function(id)       { return apiRequest("DELETE", "/platform/admins/" + id); },
  updateLicense:        function(coId, d)  { return apiRequest("PUT",    "/platform/licenses/" + coId, d); },
  setSuperAdmin:        function(coId, d)  { return apiRequest("PUT",    "/platform/companies/" + coId + "/super-admin", d); },
  getLicenseHealth:     function()         { return apiRequest("GET",    "/platform/license-health"); },
};

// ── API Status Banner component
function ApiStatusBanner(props) {
  var cfg = props.config;
  var onConfigure = props.onConfigure;
  if (cfg.enabled && cfg.baseUrl) return null;
  return (
    <div style={{background:"#FEF3C7",borderBottom:"1px solid #D97706",padding:"6px 16px",
      display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11,color:"#92400E",flexShrink:0}}>
      <span>⚠ Running in offline mode — data is not saved between sessions.</span>
      <button onClick={onConfigure}
        style={{background:"#D97706",color:"#fff",border:"none",borderRadius:6,
          padding:"3px 12px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        Connect Backend API
      </button>
    </div>
  );
}

// ── API Config Modal
function ApiConfigModal(props) {
  var onClose = props.onClose;
  var onSave  = props.onSave;
  var current = props.current || {};
  var [url, setUrl]         = useState(current.baseUrl || "");
  var [enabled, setEnabled] = useState(current.enabled || false);
  var [testing, setTesting] = useState(false);
  var [testResult, setTestResult] = useState(null);

  async function testConnection() {
    setTesting(true); setTestResult(null);
    try {
      var r = await fetch((url.replace(/\/$/, "")) + "/health");
      if (r.ok) {
        var d = await r.json();
        setTestResult({ ok: true, msg: "Connected ✓  env: " + d.env + "  ts: " + d.ts });
      } else {
        setTestResult({ ok: false, msg: "Server returned " + r.status });
      }
    } catch(e) {
      setTestResult({ ok: false, msg: "Cannot reach: " + e.message });
    }
    setTesting(false);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,width:520,boxShadow:"0 20px 60px rgba(0,0,0,.25)",fontFamily:"inherit"}}>
        <div style={{fontSize:16,fontWeight:800,color:"#0D1226",marginBottom:4}}>🔌 Connect Backend API</div>
        <div style={{fontSize:12,color:"#4A5374",marginBottom:20}}>
          Point the app to your deployed HRCloud API server. Leave blank to use offline/demo mode.
        </div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#4A5374",marginBottom:6}}>API Base URL</div>
          <input value={url} onChange={function(e){setUrl(e.target.value); setTestResult(null);}}
            placeholder="https://your-api.domain.com/api/v1"
            style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #DDE3F5",borderRadius:8,
              padding:"9px 13px",fontSize:12,color:"#0D1226",outline:"none",fontFamily:"inherit"}}/>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <input type="checkbox" id="api-enabled" checked={enabled}
            onChange={function(e){setEnabled(e.target.checked);}}/>
          <label htmlFor="api-enabled" style={{fontSize:12,color:"#0D1226",cursor:"pointer"}}>
            Enable API — send login/data to backend instead of in-memory
          </label>
        </div>

        {testResult && (
          <div style={{background:testResult.ok?"#D1FAE5":"#FEE8EA",borderRadius:8,padding:"8px 12px",
            fontSize:11,color:testResult.ok?"#059669":"#E5374A",marginBottom:14,fontWeight:600}}>
            {testResult.msg}
          </div>
        )}

        <div style={{background:"#F0F4FF",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:11,color:"#4A5374"}}>
          <strong>Deployment steps:</strong><br/>
          1. Unzip <code>hrcloud-api.zip</code> → <code>npm install</code><br/>
          2. Copy <code>.env.example</code> to <code>.env</code> and fill in DB + JWT secrets<br/>
          3. Run <code>mysql -u root -p &lt; hrcloud_malaysia.sql</code><br/>
          4. Start with <code>npm start</code> (port 5000 by default)<br/>
          5. Paste the URL above, test, then save
        </div>

        <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose}
            style={{background:"#F0F4FF",border:"1px solid #DDE3F5",color:"#4A5374",borderRadius:8,
              padding:"8px 20px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
          <button onClick={function(){testConnection();}} disabled={testing||!url}
            style={{background:"#F0F4FF",border:"1px solid #4F6EF7",color:"#4F6EF7",borderRadius:8,
              padding:"8px 20px",fontSize:12,cursor:"pointer",fontFamily:"inherit",opacity:(!url||testing)?0.5:1}}>
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <button onClick={function(){onSave({baseUrl:url,enabled:enabled&&!!url}); onClose();}}
            style={{background:"#4F6EF7",border:"none",color:"#fff",borderRadius:8,
              padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

import {
  LayoutDashboard, Users, Settings, Calendar, DollarSign, FileText, Umbrella,
  Clock, Receipt, Sparkles, BarChart2, Building2, Smartphone, GitBranch,
  ShieldCheck, User, Wrench, AlertTriangle, CheckCircle, XCircle, RotateCcw,
  Download, Printer, Pencil, Trash2, Plus, Search, Filter, ChevronDown,
  ChevronRight, ChevronUp, Eye, EyeOff, Lock, Unlock, RefreshCw, Upload,
  ArrowRight, ArrowLeft, Check, X, Info, Star, Bell, LogOut, Menu,
  TrendingUp, TrendingDown, Briefcase, UserCheck, UserX, FileSpreadsheet,
  CreditCard, Banknote, Send, Copy, Save, ExternalLink, MoreHorizontal,
  AlertCircle, BookOpen, Home, Layers, Activity, PieChart, Mail, Phone,
  MapPin, Globe, Cpu, CheckSquare
} from "lucide-react";

var C = {
  bg:"#F0F4FF", surface:"#E8EEFF", card:"#FFFFFF", border:"#DDE3F5",
  accent:"#4F6EF7", accentL:"#EEF1FE", accentD:"#3451D1",
  green:"#059669", greenL:"#D1FAE5", amber:"#D97706", amberL:"#FEF3C7",
  red:"#E5374A", redL:"#FEE8EA", purple:"#7C3AED", purpleL:"#EDE9FE",
  tp:"#0D1226", ts:"#4A5374", tm:"#B8C0DC",
  sidebar:"#FFFFFF", sidebarHover:"#F0F4FF", sidebarActive:"#EEF1FE",
  sidebarText:"#4A5374", sidebarBorder:"#DDE3F5",
};

// Style shorthands
var S = {
  row:   {display:"flex",alignItems:"center"},
  rowG4: {display:"flex",alignItems:"center",gap:4},
  rowG6: {display:"flex",alignItems:"center",gap:6},
  rowG8: {display:"flex",alignItems:"center",gap:8},
  rowG10:{display:"flex",alignItems:"center",gap:10},
  rowG12:{display:"flex",alignItems:"center",gap:12},
  rowSB: {display:"flex",alignItems:"center",justifyContent:"space-between"},
  rowJSB:{display:"flex",justifyContent:"space-between",alignItems:"center"},
  col:   {display:"flex",flexDirection:"column"},
  g2:    {display:"grid",gridTemplateColumns:"1fr 1fr",gap:16},
  g2s:   {display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},
  g2m:   {display:"grid",gridTemplateColumns:"1fr 1fr",gap:16},
  g3:    {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14},
  ts9:   {color:"#4A5374",fontSize:9},
  ts10:  {color:"#4A5374",fontSize:10},
  ts11:  {color:"#4A5374",fontSize:11},
  ts12:  {color:"#4A5374",fontSize:12},
  ts13:  {color:"#4A5374",fontSize:13},
  ts9b:  {color:"#4A5374",fontSize:9,fontWeight:700},
  ts10b: {color:"#4A5374",fontSize:10,fontWeight:700},
  ts11b: {color:"#4A5374",fontSize:11,fontWeight:700},
  tp12b: {color:"#0D1226",fontWeight:700,fontSize:12},
  tp13b: {color:"#0D1226",fontWeight:700,fontSize:13},
  tp14b: {color:"#0D1226",fontWeight:700,fontSize:14},
  tp15b: {color:"#0D1226",fontWeight:700,fontSize:15},
  mb8:   {marginBottom:8},
  mb12:  {marginBottom:12},
  mb16:  {marginBottom:16},
  mt2:   {marginTop:2},
  mt4:   {marginTop:4},
  tbl:   {width:"100%",borderCollapse:"collapse"},
  w100:  {width:"100%"},
  ovh:   {overflow:"hidden"},
  ovxa:  {overflowX:"auto"},
};

// -- SOCSO Table (65 bands, ceiling RM6,000)
var SOCSO_TABLE = [
  [30,0.40,0.10,0.30],[50,0.70,0.20,0.50],[70,1.10,0.30,0.80],[100,1.50,0.40,1.10],
  [140,2.10,0.60,1.50],[200,2.95,0.85,2.10],[300,4.35,1.25,3.10],[400,6.15,1.75,4.40],
  [500,7.85,2.25,5.60],[600,9.65,2.75,6.90],[700,11.35,3.25,8.10],[800,13.15,3.75,9.40],
  [900,14.85,4.25,10.60],[1000,16.65,4.75,11.90],[1100,18.35,5.25,13.10],[1200,20.15,5.75,14.40],
  [1300,21.85,6.25,15.60],[1400,23.65,6.75,16.90],[1500,25.35,7.25,18.10],[1600,27.15,7.75,19.40],
  [1700,28.85,8.25,20.60],[1800,30.65,8.75,21.90],[1900,32.35,9.25,23.10],[2000,34.15,9.75,24.40],
  [2100,35.85,10.25,25.60],[2200,37.65,10.75,26.90],[2300,39.35,11.25,28.10],[2400,41.15,11.75,29.40],
  [2500,42.85,12.25,30.60],[2600,44.65,12.75,31.90],[2700,46.35,13.25,33.10],[2800,48.15,13.75,34.40],
  [2900,49.85,14.25,35.60],[3000,51.65,14.75,36.90],[3100,53.35,15.25,38.10],[3200,55.15,15.75,39.40],
  [3300,56.85,16.25,40.60],[3400,58.65,16.75,41.90],[3500,60.35,17.25,43.10],[3600,62.15,17.75,44.40],
  [3700,63.85,18.25,45.60],[3800,65.65,18.75,46.90],[3900,67.35,19.25,48.10],[4000,69.15,19.75,49.40],
  [4100,70.85,20.25,50.60],[4200,72.65,20.75,51.90],[4300,74.35,21.25,53.10],[4400,76.15,21.75,54.40],
  [4500,77.85,22.25,55.60],[4600,79.65,22.75,56.90],[4700,81.35,23.25,58.10],[4800,83.15,23.75,59.40],
  [4900,84.85,24.25,60.60],[5000,86.65,24.75,61.90],[5100,88.35,25.25,63.10],[5200,90.15,25.75,64.40],
  [5300,91.85,26.25,65.60],[5400,93.65,26.75,66.90],[5500,95.35,27.25,68.10],[5600,97.15,27.75,69.40],
  [5700,98.85,28.25,70.60],[5800,100.65,28.75,71.90],[5900,102.35,29.25,73.10],[6000,104.15,29.75,74.40],
  [Infinity,104.15,29.75,74.40],
];

var EIS_TABLE = [
  [30,0.05,0.05],[50,0.10,0.10],[70,0.15,0.15],[100,0.20,0.20],
  [140,0.25,0.25],[200,0.35,0.35],[300,0.50,0.50],[400,0.70,0.70],
  [500,0.90,0.90],[600,1.10,1.10],[700,1.30,1.30],[800,1.50,1.50],
  [900,1.70,1.70],[1000,1.90,1.90],[1100,2.10,2.10],[1200,2.30,2.30],
  [1300,2.50,2.50],[1400,2.70,2.70],[1500,2.90,2.90],[1600,3.10,3.10],
  [1700,3.30,3.30],[1800,3.50,3.50],[1900,3.70,3.70],[2000,3.90,3.90],
  [2100,4.10,4.10],[2200,4.30,4.30],[2300,4.50,4.50],[2400,4.70,4.70],
  [2500,4.90,4.90],[2600,5.10,5.10],[2700,5.30,5.30],[2800,5.50,5.50],
  [2900,5.70,5.70],[3000,5.90,5.90],[3100,6.10,6.10],[3200,6.30,6.30],
  [3300,6.50,6.50],[3400,6.70,6.70],[3500,6.90,6.90],[3600,7.10,7.10],
  [3700,7.30,7.30],[3800,7.50,7.50],[3900,7.70,7.70],[4000,7.90,7.90],
  [4100,8.10,8.10],[4200,8.30,8.30],[4300,8.50,8.50],[4400,8.70,8.70],
  [4500,8.90,8.90],[4600,9.10,9.10],[4700,9.30,9.30],[4800,9.50,9.50],
  [4900,9.70,9.70],[5000,9.90,9.90],[5100,10.10,10.10],[5200,10.30,10.30],
  [5300,10.50,10.50],[5400,10.70,10.70],[5500,10.90,10.90],[5600,11.10,11.10],
  [5700,11.30,11.30],[5800,11.50,11.50],[5900,11.70,11.70],[6000,11.90,11.90],
  [Infinity,11.90,11.90],
];

function getSocso(wage, cat) {
  const c = cat === 2 ? 2 : 1;
  for (var i = 0; i < SOCSO_TABLE.length; i++) {
    var row = SOCSO_TABLE[i];
    if (wage <= row[0]) return { ee: c === 1 ? row[2] : 0, er: c === 1 ? row[1] : row[3] };
  }
  return { ee: c === 1 ? 29.75 : 0, er: c === 1 ? 104.15 : 74.40 };
};

function getEis(wage, age) {
  if (age >= 60) return { ee: 0, er: 0 };
  for (var i = 0; i < EIS_TABLE.length; i++) {
    var row = EIS_TABLE[i];
    if (wage <= row[0]) return { ee: row[2], er: row[1] };
  }
  return { ee: 11.90, er: 11.90 };
};

function getEpf(wage, age, customEe, customEr) {
  var eeRate, erRate;
  if (age >= 60) { eeRate = 0; erRate = 0.04; }
  else if (age >= 55) { eeRate = 0.055; erRate = 0.065; }
  else { eeRate = 0.11; erRate = wage <= 5000 ? 0.13 : 0.12; }
  if (customEe !== null && customEe !== undefined) eeRate = customEe / 100;
  if (customEr !== null && customEr !== undefined) erRate = customEr / 100;
  return { ee: Math.round(wage * eeRate), er: Math.round(wage * erRate) };
};

var LHDN_PCB_TABLE = [
  [1000,0],[1100,0],[1200,0],[1300,0],[1400,0],[1500,0],[1600,0],[1700,0],
  [1800,0],[1900,0],[2000,0],[2100,0],[2200,0],[2300,0],[2400,0],[2500,0],
  [2600,0],[2700,0],[2800,0],[2900,0],[3000,0],[3100,15],[3200,22],[3300,29],
  [3400,36],[3500,43],[3600,50],[3700,57],[3800,64],[3900,71],[4000,55],
  [4100,59],[4200,62],[4300,66],[4400,70],[4500,73],[4600,77],[4700,81],
  [4800,85],[4900,89],[5000,134],[5100,140],[5200,147],[5300,153],[5400,160],
  [5500,166],[5600,173],[5700,179],[5800,186],[5900,193],[6000,200],[6100,207],
  [6200,218],[6300,228],[6400,239],[6500,249],[6600,260],[6700,270],[6800,281],
  [6900,291],[7000,302],[7200,325],[7400,347],[7600,370],[7800,393],[8000,416],
  [8500,476],[9000,542],[9500,614],[10000,687],[11000,840],[12000,1001],
  [13000,1170],[14000,1346],[15000,1529],[17000,1915],[20000,2510],[25000,3580],
  [30000,4780],[35000,6155],[40000,7705],[50000,11205],[60000,15455],[70000,20205],
  [80000,25455],[100000,37455],[150000,69455]
];

// ── Full LHDN MYtax PCB/MTD Calculation (YA 2024) ──────────────────────
// Ref: LHDN e-PCB / MYtax schedule, Income Tax Act 1967
function calcChildRelief(children) {
  // children = array of {age, studying, studyLevel, disabled}
  // studyLevel: "primary"|"secondary"|"university"|"none"
  var total = 0;
  if (!children || !children.length) return total;
  children.forEach(function(c) {
    var age = parseInt(c.age) || 0;
    var disabled = c.disabled || false;
    var lvl = c.studyLevel || "none";
    if (disabled) {
      // Disabled child: RM 8,000 (plus RM 8,000 if in university = RM 16,000 total)
      total += 8000;
      if (lvl === "university") total += 8000;
    } else if (age <= 18) {
      // Below 18: RM 2,000 each
      total += 2000;
    } else if (age <= 23) {
      // 18-23 in full-time study at recognised institution
      if (lvl === "university" || lvl === "secondary") {
        total += 8000; // RM 8,000 for tertiary / A-Level etc
      } else if (lvl === "primary") {
        total += 2000;
      }
    }
    // Above 23 with no study = no relief
  });
  return total;
}

function getPcb(monthly, emp_opts) {
  // emp_opts may be boolean (legacy: spouseRelief) or object with full reliefs
  var opts = {};
  if (typeof emp_opts === "boolean") {
    // Legacy call: getPcb(monthly, spouseRelief, children_count)
    opts.spouseRelief    = emp_opts;
    opts.simpleChildren  = arguments[2] || 0;
  } else if (typeof emp_opts === "object" && emp_opts !== null) {
    opts = emp_opts;
  }

  var annual = monthly * 12;

  // ── Statutory reliefs ─────────────────────────────────────────────────
  var epfRelief     = Math.min((opts.epfEeAmt || monthly * 0.11) * 12, 4000);
  var lifeIns       = Math.min((parseFloat(opts.lifeInsurance)||0) + epfRelief, 7000) - epfRelief; // life ins + EPF cap 7000 total
  var combLifeEpf   = Math.min(epfRelief + (parseFloat(opts.lifeInsurance)||0), 7000);
  var medIns        = Math.min(parseFloat(opts.medicalInsurance)||0, 3000);
  var selfRelief    = 9000; // Personal self relief
  var selfDisabled  = opts.selfDisabled ? 6000 : 0;    // additional if OKU
  var selfStudy     = opts.selfStudying ? Math.min(parseFloat(opts.educationFees)||7000, 7000) : 0;
  var spouseRel     = opts.spouseRelief ? 4000 : 0;
  var spouseDisRel  = (opts.spouseRelief && opts.spouseDisabled) ? 3500 : 0;
  var medSelf       = Math.min(parseFloat(opts.medicalSelf)||0, 10000); // Medical for self/spouse/parents
  var medParents    = Math.min(parseFloat(opts.medicalParents)||0, 8000);
  var disEquip      = Math.min(parseFloat(opts.disabilityEquipment)||0, 6000);
  var breastfeeding = Math.min(parseFloat(opts.breastfeeding)||0, 1000);
  var childcare     = Math.min(parseFloat(opts.childcareRelief)||0, 3000);
  var sport         = Math.min(parseFloat(opts.sportEquipment)||0, 1000);
  var domTourism    = Math.min(parseFloat(opts.domesticTourism)||0, 1000);
  var evCharge      = Math.min(parseFloat(opts.electricVehicleCharge)||0, 2500);
  var prs           = Math.min(parseFloat(opts.privateRetirement)||0, 3000);
  var ssp           = Math.min(parseFloat(opts.sspRelief)||0, 3000);

  // ── Child relief ──────────────────────────────────────────────────────
  var childRel = 0;
  if (opts.childrenDetails && opts.childrenDetails.length) {
    childRel = calcChildRelief(opts.childrenDetails);
  } else {
    // Legacy simple children count: RM 2,000 each
    childRel = (opts.simpleChildren || parseInt(opts.pcbChildren) || 0) * 2000;
  }

  // ── Total relief ──────────────────────────────────────────────────────
  var totalRelief = selfRelief + selfDisabled + selfStudy +
    combLifeEpf + medIns +
    spouseRel + spouseDisRel +
    childRel +
    medSelf + medParents + disEquip +
    breastfeeding + childcare + sport + domTourism + evCharge + prs + ssp;

  var chargeable = Math.max(0, annual - totalRelief);

  // ── Progressive tax brackets (YA 2024, Income Tax Act s.4) ───────────
  // [ceiling of bracket, rate]
  var BRACKETS = [
    [5000,   0.00],
    [15000,  0.01],
    [15000,  0.03],
    [15000,  0.06],
    [20000,  0.11],
    [15000,  0.19],
    [15000,  0.25],
    [Infinity,0.28],
  ];
  var tax = 0; var floor = 5000;
  for (var i = 0; i < BRACKETS.length; i++) {
    if (chargeable <= floor) break;
    tax += Math.min(chargeable - floor, BRACKETS[i][0]) * BRACKETS[i][1];
    floor += BRACKETS[i][0];
  }
  var monthlyPCB = Math.round(tax / 12);

  // ── Use official LHDN PCB table for simple cases (no reliefs set) ─────
  var isSimple = !opts.spouseRelief && !opts.selfDisabled && !opts.selfStudying &&
    !opts.spouseDisabled && childRel === 0 &&
    !opts.lifeInsurance && !opts.medicalInsurance && !opts.medicalSelf &&
    !opts.privateRetirement && !opts.prs;
  if (isSimple && monthly >= 1000 && monthly <= 150000) {
    var rounded = Math.round(monthly / 100) * 100;
    for (var j = 0; j < LHDN_PCB_TABLE.length; j++) {
      if (LHDN_PCB_TABLE[j][0] === rounded) {
        return { chargeable: Math.round(chargeable), monthlyPCB: LHDN_PCB_TABLE[j][1],
          totalRelief: Math.round(totalRelief), annual: Math.round(annual) };
      }
    }
  }
  return { chargeable: Math.round(chargeable), monthlyPCB: monthlyPCB,
    totalRelief: Math.round(totalRelief), annual: Math.round(annual) };
};

function resolveRate(r, c) { return r === "custom" ? (parseFloat(c) || 0) : (parseFloat(r) || 0); }
function calcLateDeduction(lateMinTotal, waived, dailyRate, hourlyRate, pc) {
  if (!lateMinTotal || lateMinTotal <= 0) return {lateAmt:0, lateMethod:"none", lateNote:""};
  var grace = (pc && pc.gracePeriodMin) || 0;
  var netLate = Math.max(0, lateMinTotal - grace);
  if (netLate <= 0 || waived) return {lateAmt:0, lateMethod:"waived", lateNote:"Within grace period or waived"};
  var tiers = (pc && pc.latePenaltyTiers) || [];
  var tier = null;
  for (var i = 0; i < tiers.length; i++) {
    if (netLate >= tiers[i].minLateMin && netLate <= tiers[i].maxLateMin) { tier = tiers[i]; break; }
  }
  if (!tier) {
    // fallback: hourly prorate
    var amt0 = parseFloat(((netLate / 60) * hourlyRate).toFixed(2));
    return {lateAmt:amt0, lateMethod:"hourly", lateNote:"Hourly prorate ("+netLate+" min)"};
  }
  var amt = 0; var method = tier.type; var note = tier.label || "";
  if (tier.type === "warning")        { amt = 0; }
  else if (tier.type === "deduct_fixed")   { amt = parseFloat((tier.amount || 0).toFixed(2)); }
  else if (tier.type === "deduct_per_min") { amt = parseFloat(((tier.amount || 0) * netLate).toFixed(2)); }
  else if (tier.type === "half_day")       { amt = parseFloat((dailyRate / 2).toFixed(2)); }
  else if (tier.type === "full_day")       { amt = parseFloat(dailyRate.toFixed(2)); }
  return {lateAmt:amt, lateMethod:method, lateNote:note, netLateMin:netLate};
}

function computeRow(emp, wd, ov, schedStats, payrollCfg) {
  ov = ov || {};
  var pc = payrollCfg || INIT_PAYROLL_CONFIG;
  var realWd = (schedStats && schedStats.workingDays > 0) ? schedStats.workingDays : (wd || 26);
  var realHrsPerDay = (schedStats && schedStats.netHrsPerDay > 0) ? schedStats.netHrsPerDay : 8;
  wd = realWd;
  var basic = parseFloat(emp.basic) || 0;
  var backdate = parseFloat(ov.backdate) || 0;
  var pil = parseFloat(ov.pil) || 0;
  var support = parseFloat(emp.supportAllow) || 0;
  var travel = parseFloat(emp.travelAllow) || 0;
  var other = parseFloat(emp.otherAllow) || 0;
  var incentive = parseFloat(ov.incentive) || 0;
  var otHours = parseFloat(ov.otHours) || 0;
  var unpaidDays = parseFloat(ov.unpaidDays) || 0;
  var lateMinRaw = parseFloat(ov.lateMin) || 0;
  var lateHours  = lateMinRaw > 0 ? lateMinRaw / 60 : (parseFloat(ov.lateHours) || 0);
  var lateMinTotal = lateMinRaw > 0 ? lateMinRaw : Math.round(lateHours * 60);
  var waived = ov.lateWaived || false;
  // CP38: use override if set, else auto-apply from employee record if within active date range
  var cp38 = parseFloat(ov.cp38) || 0;
  if (!cp38 && emp.cp38Amount > 0 && emp.cp38DateFrom && emp.cp38DateTo) {
    var batchMonth = (ov._batchMonth || "");
    var cp38From = emp.cp38DateFrom.slice(0,7); // "YYYY-MM"
    var cp38To   = emp.cp38DateTo.slice(0,7);
    if (!batchMonth || (batchMonth >= cp38From && batchMonth <= cp38To)) {
      cp38 = parseFloat(emp.cp38Amount) || 0;
    }
  }
  var paIns = parseFloat(ov.paIns) || 0;
  var loan = parseFloat(ov.loan) || 0;
  var age = parseInt(emp.age) || 35;
  var dailyRate = parseFloat((basic / wd).toFixed(4));
  var hourlyRate = parseFloat((basic / (wd * realHrsPerDay)).toFixed(4));
  var otAmt = parseFloat((otHours * hourlyRate * 1.5).toFixed(2));
  var grossTotal = parseFloat((basic + backdate + pil + support + travel + other + incentive + otAmt).toFixed(2));
  var unpaidAmt = parseFloat((unpaidDays * dailyRate).toFixed(2));
  // Smart late deduction using payroll config tiers
  var lateCalc = calcLateDeduction(lateMinTotal, waived, dailyRate, hourlyRate, pc);
  var lateAmt = lateCalc.lateAmt;
  var adjDeduct = parseFloat((unpaidAmt + lateAmt).toFixed(2));
  var subTotal = parseFloat((grossTotal - adjDeduct).toFixed(2));
  var eeR = emp.epfEeRate === "custom" ? (parseFloat(emp.epfEeCustom) || 0) / 100 : age >= 60 ? 0 : age >= 55 ? 0.055 : 0.11;
  var erR = emp.epfErRate === "custom" ? (parseFloat(emp.epfErCustom) || 0) / 100 : age >= 60 ? 0.04 : age >= 55 ? 0.065 : basic <= 5000 ? 0.13 : 0.12;
  var epfEe = Math.round(basic * eeR);
  var epfEr = Math.round(basic * erR);
  var socsoCat = (emp.socsoCat === "2" || age >= 60) ? 2 : 1;
  var socsoData = getSocso(basic, socsoCat);
  var socsoEe = socsoData.ee;
  var socsoEr = socsoData.er;
  var eisData = getEis(basic, age);
  var eisEe = eisData.ee;
  var eisEr = eisData.er;
  var pcbOpts = {
    spouseRelief: emp.spouseRelief || false,
    spouseDisabled: emp.spouseDisabled || false,
    selfDisabled: emp.selfDisabled || false,
    selfStudying: emp.selfStudying || false,
    educationFees: emp.educationFees || 0,
    childrenDetails: emp.childrenDetails || [],
    pcbChildren: parseInt(emp.pcbChildren) || 0,
    epfEeAmt: epfEe,
    lifeInsurance: emp.lifeInsurance || 0,
    medicalInsurance: emp.medicalInsurance || 0,
    medicalSelf: emp.medicalSelf || 0,
    medicalParents: emp.medicalParents || 0,
    disabilityEquipment: emp.disabilityEquipment || 0,
    breastfeeding: emp.breastfeeding || 0,
    childcareRelief: emp.childcareRelief || 0,
    sportEquipment: emp.sportEquipment || 0,
    domesticTourism: emp.domesticTourism || 0,
    electricVehicleCharge: emp.electricVehicleCharge || 0,
    privateRetirement: emp.privateRetirement || 0,
    sspRelief: emp.sspRelief || 0,
  };
  var pcbData = getPcb(basic, pcbOpts);
  var pcb = pcbData.monthlyPCB;
  var hrdf = (emp.hrdfEnabled !== false && basic > 0) ? parseFloat((basic * 0.01).toFixed(2)) : 0;
  var totalDeduct = parseFloat((adjDeduct + cp38 + paIns + loan + pcb + epfEe + socsoEe + eisEe).toFixed(2));
  var netTotal = parseFloat((grossTotal - totalDeduct).toFixed(2));
  return {
    empId: emp.id, empNo: emp.empNo||emp.id, name: emp.name, dept: emp.dept, age: age,
    basic: basic, backdate: backdate, pil: pil, support: support, travel: travel,
    other: other, otherLabel: emp.otherAllowLabel || "", incentive: incentive,
    otHours: otHours, otAmt: otAmt, grossTotal: grossTotal,
    unpaidDays: unpaidDays, lateHours: lateHours, lateMinTotal: lateMinTotal, unpaidAmt: unpaidAmt,
    lateAmt: lateAmt, lateMethod: lateCalc.lateMethod, lateNote: lateCalc.lateNote,
    lateWaived: waived, adjDeduct: adjDeduct, subTotal: subTotal,
    cp38: cp38, paIns: paIns, loan: loan,
    pcb: pcb, epfEe: epfEe, epfEr: epfEr, socsoEe: socsoEe, socsoEr: socsoEr,
    eisEe: eisEe, eisEr: eisEr, hrdf: hrdf, totalDeduct: totalDeduct, netTotal: netTotal,
    dailyRate: dailyRate, hourlyRate: hourlyRate,
    schedWd: wd, schedHrsPerDay: realHrsPerDay,
    schedStart: (schedStats && schedStats.start) || "08:00",
    schedEnd: (schedStats && schedStats.end) || "17:00",
    fromSchedule: schedStats ? true : false,
  };
};

function rm(v) { return "RM " + parseFloat(v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function sumF(arr, k) { return parseFloat(arr.reduce(function(s, r) { return s + (parseFloat(r[k]) || 0); }, 0).toFixed(2)); }
function computeScheduleStats(empId, batchMonth, sched, wh, unifiedShift, schedMode) {
  if (!batchMonth) return null;
  var parts = batchMonth.split("-");
  var yr = parseInt(parts[0]); var mo = parseInt(parts[1]) - 1;
  var daysInMonth = new Date(yr, mo + 1, 0).getDate();
  var DSHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  var empWh = (wh || {})[empId] || {start:"08:00",end:"17:00",brk:60,ot:false,flexible:false};
  var netHrsPerDay = 0;
  if (empWh.start && empWh.end) {
    var sp = empWh.start.split(":"); var ep = empWh.end.split(":");
    var sm = parseInt(sp[0])*60+parseInt(sp[1]);
    var em2 = parseInt(ep[0])*60+parseInt(ep[1]);
    if (em2 <= sm) em2 += 24*60;
    netHrsPerDay = Math.max(0, (em2 - sm - (parseInt(empWh.brk)||0)) / 60);
  }
  var workingDays = 0;
  var empSched = (sched || {})[empId] || {};
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = yr+"-"+String(mo+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    var jsDay = new Date(yr, mo, d).getDay();
    var dayIdx = [6,0,1,2,3,4,5][jsDay];
    var dayKey = DSHORT[dayIdx];
    var shiftId;
    if (empSched[dateStr] !== undefined) {
      shiftId = empSched[dateStr];
    } else if (schedMode === "on") {
      shiftId = (dayKey === "Sat" || dayKey === "Sun") ? "off" : "morning";
    } else {
      shiftId = (unifiedShift || {})[dayKey] || "off";
    }
    if (shiftId !== "off") workingDays++;
  }
  return {
    workingDays: workingDays,
    netHrsPerDay: parseFloat(netHrsPerDay.toFixed(4)),
    start: empWh.start || "08:00",
    end: empWh.end || "17:00",
    brk: empWh.brk || 60,
    flexible: empWh.flexible || false,
    otEligible: empWh.ot || false,
  };
}

// -- INIT DATA
var EMPTY_EMP = {
  id:"",empNo:"",name:"",preferredName:"",gender:"Male",dob:"",nric:"",nationality:"Malaysian",email:"",
  religion:"",race:"",maritalStatus:"Single",spouseNric:"",spouseName:"",children:0,
  dept:"",grade:"",role:"Staff",position:"",employmentType:"Permanent",
  joinDate:"",confirmDate:"",resignDate:"",status:"Active",
  basic:0,prevBasic:0,incrementDate:"",incrementAmt:0,
  supportAllow:0,travelAllow:0,otherAllow:0,otherAllowLabel:"",
  epfEeRate:11,epfErRate:13,epfEeCustom:"",epfErCustom:"",
  socsoCat:"1",hrdfEnabled:true,spouseRelief:false,pcbChildren:0,
  spouseDisabled:false,selfDisabled:false,selfStudying:false,selfStudyInstitution:"",
  childrenDetails:[],
  lifeInsurance:0,medicalInsurance:0,educationFees:0,medicalSelf:0,disabilityEquipment:0,
  medicalParents:0,breastfeeding:0,childcareRelief:0,sportEquipment:0,
  domesticTourism:0,electricVehicleCharge:0,privateRetirement:0,sspRelief:0,
  socso:0,eis:0,pcb:0,risk:"low",age:0,managerId:null,
  phone:"",altPhone:"",personalEmail:"",workEmail:"",
  addr1:"",addr2:"",city:"",postcode:"",state:"",country:"Malaysia",
  epfNo:"",socsoNo:"",eisNo:"",taxNo:"",taxBranch:"",
  cp38Amount:0,cp38Ref:"",cp38DateFrom:"",cp38DateTo:"",
  bankName:"",bankAcc:"",bankHolder:"",
  emerName:"",emerRel:"",emerPhone:"",emerPhone2:"",
  passportNo:"",passportExp:"",permitNo:"",permitExp:"",
};

var INIT_EMPLOYEES = [
  Object.assign({}, EMPTY_EMP, {
    id:"E001",empNo:"EMP001",name:"Ahmad Farid bin Azman",preferredName:"Farid",gender:"Male",
    dob:"1985-01-01",nric:"850101-14-1234",nationality:"Malaysian",religion:"Islam",
    race:"Malay",maritalStatus:"Married",spouseName:"Nor Azura binti Razali",children:2,
    spouseRelief:true,pcbChildren:2,dept:"Finance",grade:"G4",role:"HR Manager",
    position:"Senior Finance Manager",employmentType:"Permanent",
    joinDate:"2018-03-15",confirmDate:"2018-09-15",status:"Active",
    basic:5800,prevBasic:5500,incrementDate:"2024-01-01",incrementAmt:300,
    travelAllow:200,age:40,epfEeRate:11,epfErRate:12,socsoCat:"1",hrdfEnabled:true,
    phone:"012-3456789",personalEmail:"farid@gmail.com",workEmail:"farid@techcorp.com.my",
    addr1:"No. 12, Jalan Damai 3",addr2:"Taman Damai Perdana",city:"Kuala Lumpur",
    postcode:"56000",state:"W.P. Kuala Lumpur",country:"Malaysia",
    epfNo:"EP-12345601",socsoNo:"SO-12345601",eisNo:"EI-12345601",
    taxNo:"SG-1234560000",taxBranch:"LHDN KL",
    bankName:"Maybank",bankAcc:"1122334455",bankHolder:"Ahmad Farid bin Azman",
    emerName:"Nor Azura binti Razali",emerRel:"Spouse",emerPhone:"013-9876543",
  }),
  Object.assign({}, EMPTY_EMP, {
    id:"E002",empNo:"EMP002",name:"Siti Nurul Ain binti Hassan",preferredName:"Ain",gender:"Female",
    dob:"1990-02-15",nric:"900215-08-5678",nationality:"Malaysian",religion:"Islam",
    race:"Malay",maritalStatus:"Married",spouseName:"Mohd Izzat bin Yusof",children:1,
    spouseRelief:true,pcbChildren:1,dept:"HR",grade:"G3",role:"HR Manager",
    position:"HR Executive",employmentType:"Permanent",
    joinDate:"2020-06-01",confirmDate:"2020-12-01",status:"Active",
    basic:4200,prevBasic:4000,travelAllow:150,age:35,
    epfEeRate:11,epfErRate:13,socsoCat:"1",hrdfEnabled:true,
    phone:"011-2345678",personalEmail:"ain@gmail.com",workEmail:"ain@techcorp.com.my",
    addr1:"Unit 8-3, Residensi Harmoni",city:"Kuala Lumpur",postcode:"50100",
    state:"W.P. Kuala Lumpur",country:"Malaysia",
    epfNo:"EP-12345602",socsoNo:"SO-12345602",eisNo:"EI-12345602",
    taxNo:"SG-1234560001",taxBranch:"LHDN Wangsa Maju",
    bankName:"CIMB",bankAcc:"9988776655",bankHolder:"Siti Nurul Ain binti Hassan",
    cp38Amount:150,cp38Ref:"CP38/2024/001234",cp38DateFrom:"2024-01-01",cp38DateTo:"2026-12-31",
    emerName:"Hassan bin Mahmud",emerRel:"Father",emerPhone:"019-7654321",
  }),
  Object.assign({}, EMPTY_EMP, {
    id:"E003",empNo:"EMP003",name:"Rajesh Kumar Nair",preferredName:"Rajesh",gender:"Male",
    dob:"1988-05-20",nric:"880520-10-9012",nationality:"Malaysian",religion:"Hindu",
    race:"Indian",maritalStatus:"Single",dept:"IT",grade:"G5",role:"Manager",
    position:"IT Manager",employmentType:"Permanent",
    joinDate:"2016-08-10",confirmDate:"2017-02-10",status:"Active",
    basic:7500,prevBasic:7000,supportAllow:200,travelAllow:300,risk:"high",age:37,managerId:"E001",
    epfEeRate:11,epfErRate:12,socsoCat:"1",hrdfEnabled:true,
    phone:"016-8887777",personalEmail:"rajesh.kumar@gmail.com",workEmail:"rajesh@techcorp.com.my",
    addr1:"No. 45, Jalan SS15/4",city:"Subang Jaya",postcode:"47500",
    state:"Selangor",country:"Malaysia",
    epfNo:"EP-12345603",socsoNo:"SO-12345603",eisNo:"EI-12345603",
    taxNo:"SG-1234560002",taxBranch:"LHDN Petaling Jaya",
    bankName:"Maybank",bankAcc:"5544332211",bankHolder:"Rajesh Kumar Nair",
    emerName:"Kumar Nair",emerRel:"Father",emerPhone:"017-3334444",
  }),
  Object.assign({}, EMPTY_EMP, {
    id:"E004",empNo:"EMP004",name:"Lim Wei Ting",preferredName:"Wei Ting",gender:"Female",
    dob:"1992-06-30",nric:"920630-14-3456",nationality:"Malaysian",religion:"Buddhism",
    race:"Chinese",maritalStatus:"Single",dept:"Sales",grade:"G3",role:"Staff",
    position:"Sales Executive",employmentType:"Permanent",
    joinDate:"2022-01-10",confirmDate:"2022-07-10",status:"Active",
    basic:4800,prevBasic:4500,travelAllow:200,otherAllow:500,otherAllowLabel:"Sales Incentive",
    risk:"medium",age:33,managerId:"E003",epfEeRate:11,epfErRate:13,socsoCat:"1",hrdfEnabled:true,
    phone:"018-5556666",personalEmail:"weiting@gmail.com",workEmail:"weiting@techcorp.com.my",
    addr1:"A-12-5, The Horizon",city:"Bangsar South",postcode:"59200",
    state:"W.P. Kuala Lumpur",country:"Malaysia",
    epfNo:"EP-12345604",socsoNo:"SO-12345604",eisNo:"EI-12345604",
    taxNo:"SG-1234560003",taxBranch:"LHDN Bangsar",
    bankName:"RHB",bankAcc:"2233445566",bankHolder:"Lim Wei Ting",
    emerName:"Lim Ah Kow",emerRel:"Father",emerPhone:"016-2223333",
  }),
  Object.assign({}, EMPTY_EMP, {
    id:"E005",name:"Nurul Hidayah binti Razak",preferredName:"Hidayah",gender:"Female",
    dob:"1963-09-01",nric:"630901-03-7890",nationality:"Malaysian",religion:"Islam",
    race:"Malay",maritalStatus:"Widowed",children:3,
    dept:"Operations",grade:"G2",role:"Staff",position:"Operations Assistant",
    employmentType:"Permanent",joinDate:"2010-04-01",confirmDate:"2010-10-01",status:"Probation",
    basic:3200,prevBasic:3000,travelAllow:100,risk:"low",age:61,managerId:"E003",
    epfEeRate:0,epfErRate:6,socsoCat:"2",hrdfEnabled:false,
    phone:"014-7778888",personalEmail:"hidayah@gmail.com",workEmail:"hidayah@techcorp.com.my",
    addr1:"No. 7, Lorong Maju 5",city:"Klang",postcode:"41000",
    state:"Selangor",country:"Malaysia",
    epfNo:"EP-12345605",socsoNo:"SO-12345605",eisNo:"EI-12345605",
    taxNo:"SG-1234560004",taxBranch:"LHDN Shah Alam",
    bankName:"BSN",bankAcc:"6677889900",bankHolder:"Nurul Hidayah binti Razak",
    emerName:"Razak bin Abdullah",emerRel:"Son",emerPhone:"019-1112222",
  }),
];

var ALL_MODULES = [
  {id:"dashboard",  label:"Dashboard",        icon:<LayoutDashboard size={15}/>},
  {id:"employee",   label:"Employees",        icon:<Users size={15}/>},
  {id:"empconfig",  label:"HR Config",        icon:<Settings size={15}/>},
  {id:"schedule",   label:"Scheduling",       icon:<Calendar size={15}/>},
  {id:"payroll",    label:"Payroll",          icon:<DollarSign size={15}/>},
  {id:"statutory",  label:"Statutory",        icon:<FileText size={15}/>},
  {id:"leave",      label:"Leave",            icon:<Umbrella size={15}/>},
  {id:"attendance", label:"Attendance",       icon:<Clock size={15}/>},
  {id:"claims",     label:"Claims",           icon:<Receipt size={15}/>},
  {id:"ai",         label:"AI Engine",        icon:<Sparkles size={15}/>},
  {id:"reports",    label:"Reports",          icon:<BarChart2 size={15}/>},
  {id:"bank",       label:"Bank Files",       icon:<Building2 size={15}/>},
  {id:"mobile",     label:"Mobile App",       icon:<Smartphone size={15}/>},
  {id:"hierarchy",  label:"Org Chart",        icon:<GitBranch size={15}/>},
  {id:"permissions",label:"Permissions",      icon:<ShieldCheck size={15}/>},
  {id:"myportal",   label:"My Portal",        icon:<User size={15}/>},
  {id:"setup",      label:"Setup",            icon:<Wrench size={15}/>},
  {id:"import",     label:"Import Data",      icon:<Upload size={15}/>},
];

var ROLE_PRESETS = {
  "Super Admin": ALL_MODULES.map(function(m) { return m.id; }),
  "HR Manager": ["dashboard","employee","empconfig","schedule","payroll","statutory","leave","attendance","claims","ai","reports","bank","hierarchy","permissions","myportal","setup","import"],
  "Payroll Admin": ["dashboard","employee","payroll","statutory","reports","bank","myportal"],
  "Manager": ["dashboard","schedule","leave","attendance","claims","reports","myportal"],
  "Staff": ["myportal"],
};

var INIT_ROLE_PERMS = (function() {
  var result = {};
  var keys = Object.keys(ROLE_PRESETS);
  for (var i = 0; i < keys.length; i++) {
    result[keys[i]] = new Set(ROLE_PRESETS[keys[i]]);
  }
  return result;
})();

/* ══════════════════════════════════════════════════════════
   PLATFORM LICENSE & AUTHENTICATION SYSTEM
   Login  : Employee ID  (e.g. E001)
   Password: Last 6 digits of NRIC  (e.g. 141234)
   Super-admin login via Platform Admin panel
══════════════════════════════════════════════════════════ */

// Platform-level administrator accounts (HRCloud vendor admin)
var PLATFORM_ADMINS = [
  {id:"PA001",name:"HRCloud Support",email:"support@hrcloud.my",pin:"HRCLOUD2025",role:"Platform Admin"},
  {id:"PA002",name:"System Engineer", email:"syseng@hrcloud.my", pin:"SYSENG2025", role:"Platform Admin"},
];

// License tiers
var LICENSE_TIERS = [
  {id:"starter",  label:"Starter",   maxStaff:10,  price:99,   color:"#059669"},
  {id:"growth",   label:"Growth",    maxStaff:25,  price:199,  color:"#4F6EF7"},
  {id:"business", label:"Business",  maxStaff:50,  price:349,  color:"#7C3AED"},
  {id:"enterprise",label:"Enterprise",maxStaff:200, price:599,  color:"#D97706"},
  {id:"unlimited",label:"Unlimited", maxStaff:9999, price:999,  color:"#E5374A"},
];

// Per-company license data (keyed by company id)
var INIT_LICENSES = {
  "CO001":{tier:"growth",   maxStaff:25,  status:"Active",   expiry:"2026-12-31",key:"HRCLOUDCO001-2025",issuedBy:"PA001",issuedOn:"2025-01-01"},
  "CO002":{tier:"starter",  maxStaff:10,  status:"Active",   expiry:"2026-06-30",key:"HRCLOUDCO002-2025",issuedBy:"PA001",issuedOn:"2025-01-01"},
};

// Derive IC last-6 as password
function empPassword(emp){
  var ic = (emp.nric||"").replace(/[^0-9]/g,"");
  return ic.length>=6 ? ic.slice(-6) : ic || "000000";
}

// Auth helper — returns {ok, emp, role, isPlatformAdmin} or {ok:false, error}
function authenticate(loginId, password, employees, isPlatformLogin, isSuperAdmin, companies, activeCompany){
  // Platform vendor admin
  if(isPlatformLogin){
    var pa = PLATFORM_ADMINS.find(function(a){return a.id===loginId&&a.pin===password;});
    if(pa) return {ok:true,emp:null,role:"Platform Admin",isPlatformAdmin:true,admin:pa};
    return {ok:false,error:"Invalid Platform Admin credentials"};
  }
  // Company Super Admin
  if(isSuperAdmin){
    var co = (companies||[]).find(function(c){return c.id===activeCompany;});
    if(!co) return {ok:false,error:"Company not found"};
    if(!co.superAdminPin) return {ok:false,error:"No Super Admin set for this company — contact Platform Admin"};
    if(loginId!==co.superAdminId) return {ok:false,error:"Super Admin ID not recognised"};
    if(password!==co.superAdminPin) return {ok:false,error:"Incorrect Super Admin password"};
    return {ok:true,emp:null,role:"Super Admin",isPlatformAdmin:false,isSuperAdmin:true,
      admin:{id:co.superAdminId,name:co.superAdminName||"Super Admin",company:co.name}};
  }
  // Regular employee
  var emp = employees.find(function(e){return e.id===loginId||e.empNo===loginId;});
  if(!emp) return {ok:false,error:"Employee ID not found"};
  if(empPassword(emp)!==password) return {ok:false,error:"Incorrect password (last 6 digits of IC)"};
  if(emp.status==="Inactive"||emp.status==="Terminated") return {ok:false,error:"Account inactive — contact HR"};
  return {ok:true,emp:emp,role:emp.role||"Staff",isPlatformAdmin:false,isSuperAdmin:false};
}

/* ══ LICENSE GATE ══ */
function checkLicense(license, empCount){
  if(!license) return {ok:false,msg:"No license found for this company"};
  if(license.status!=="Active") return {ok:false,msg:"License is "+license.status};
  if(empCount>license.maxStaff) return {ok:false,msg:"Staff limit exceeded ("+empCount+"/"+license.maxStaff+")"};
  var exp=new Date(license.expiry||"2000-01-01");
  if(exp<new Date()) return {ok:false,msg:"License expired on "+license.expiry};
  return {ok:true};
}

var INIT_COMPANIES = [
  {id:"CO001",name:"TechCorp Sdn. Bhd.",tradeName:"TechCorp",ssmNo:"202001012345",
   lhdnNo:"C 1234567890",epfNo:"EP 1234567",socsoNo:"SO 1234567",
   phone:"03-22345678",email:"hr@techcorp.com.my",
   addr1:"Level 18, Menara TechCorp",addr2:"Jalan Ampang",
   city:"Kuala Lumpur",postcode:"50450",state:"W.P. Kuala Lumpur",country:"Malaysia",
   payrollCycle:"Monthly",payDay:"Last Working Day",status:"Active",
   bankName:"Maybank",bankAcc:"1234567890",
   superAdminId:"SA001",superAdminName:"TechCorp Admin",superAdminPin:"Admin@TC2025"},
  {id:"CO002",name:"TechCorp Logistics Sdn. Bhd.",tradeName:"TC Logistics",ssmNo:"202101056789",
   lhdnNo:"C 0987654321",epfNo:"EP 7654321",socsoNo:"SO 7654321",
   phone:"07-3234567",email:"hr@tclogistics.com.my",
   addr1:"No. 5, Jalan Indah 3",city:"Johor Bahru",postcode:"81300",
   state:"Johor",country:"Malaysia",payrollCycle:"Monthly",payDay:"25th",status:"Active",
   bankName:"CIMB",bankAcc:"9876543210",
   superAdminId:"SA002",superAdminName:"TC Logistics Admin",superAdminPin:"Admin@TCL2025"},
];

// -- ATOMS
var inputStyle = {
  width:"100%",boxSizing:"border-box",background:"#fff",
  border:"1.5px solid "+C.border,borderRadius:8,padding:"9px 13px",
  color:C.tp,fontSize:13,outline:"none",fontFamily:"inherit",
};
var selectStyle = {
  background:C.card,border:"1px solid "+C.border,color:C.tp,
  borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",
};

function Chip(props) {
  var text = props.text, c = props.c, bg = props.bg;
  return (
    <span style={{background:bg||(c+"18"),color:c,border:"1px solid "+(c+"30"),
      borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,letterSpacing:"0.02em",
      display:"inline-flex",alignItems:"center",whiteSpace:"nowrap"}}>
      {text}
    </span>  );
}

function StatusChip(props) {
  var map = {
    Active:{c:C.green},Probation:{c:C.amber},Pending:{c:C.amber},
    Approved:{c:C.green},Rejected:{c:C.red},Flagged:{c:C.red},
    Present:{c:C.green},Late:{c:C.amber},Absent:{c:C.red},
    Ready:{c:C.green},"Pending Approval":{c:C.amber},
    HIGH:{c:C.red},MEDIUM:{c:C.amber},LOW:{c:C.green},
    Draft:{c:C.accent},Confirmed:{c:C.accent},Paid:{c:C.green},Published:{c:C.green},
    "Super Admin":{c:C.red},"HR Manager":{c:C.accent},
    "Payroll Admin":{c:C.purple},Manager:{c:C.amber},Staff:{c:C.ts},
    Resigned:{c:C.red},Terminated:{c:C.red},
  };
  var cfg = map[props.s] || {c:C.ts};
  return <Chip text={props.s} c={cfg.c} />;
}

function Btn(props) {
  var c = props.c || C.accent;
  var disabled = props.disabled;
  var solid = props.solid;
  return (
    <button onClick={props.onClick} disabled={disabled} style={{
      background: disabled ? "#E8EEFF" : solid ? c : (c+"14"),
      color: disabled ? C.tm : solid ? "#fff" : c,
      border: "1px solid " + (disabled ? C.border : solid ? c : (c+"35")),
      borderRadius: 8,
      padding: props.sm ? "4px 11px" : "8px 16px",
      fontSize: props.sm ? 11 : 13,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      whiteSpace: "nowrap",
      transition: "all .15s",
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      letterSpacing: "0.01em",
    }}>
      {props.children}
    </button>  );
}

function Card(props) {
  return (
    <div style={Object.assign({
      background:C.card,border:"1px solid "+C.border,borderRadius:16,
      padding:props.noPad?0:22,
      boxShadow:"0 1px 3px rgba(79,110,247,.06), 0 4px 16px rgba(13,18,38,.04)",
    }, props.style||{})}>
      {props.children}
    </div>  );
}

function SectionHead(props) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
      <div>
        <h2 style={{color:C.tp,fontSize:20,fontWeight:800,margin:0,letterSpacing:"-0.5px",lineHeight:1.2}}>{props.title}</h2>
        {props.sub && <p style={{color:C.ts,fontSize:13,margin:"5px 0 0",fontWeight:400}}>{props.sub}</p>}
      </div>
      {props.action && <div style={{flexShrink:0}}>{props.action}</div>}
    </div>  );
}

function Avatar(props) {
  var name = props.name || "?";
  var size = props.size || 34;
  var initials = name.split(" ").map(function(n) { return n[0]; }).slice(0,2).join("").toUpperCase();
  var gradients = [
    "linear-gradient(135deg,#4F6EF7,#7C3AED)",
    "linear-gradient(135deg,#059669,#0EA5E9)",
    "linear-gradient(135deg,#F59E0B,#EF4444)",
    "linear-gradient(135deg,#EC4899,#8B5CF6)",
    "linear-gradient(135deg,#14B8A6,#4F6EF7)",
  ];
  var idx = name.charCodeAt(0) % gradients.length;
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:gradients[idx],
      color:"#fff",fontWeight:700,fontSize:size*0.36,
      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
      boxShadow:"0 2px 8px rgba(79,110,247,.3)"}}>
      {initials}
    </div>  );
}

function RiskBar(props) {
  var score = props.score;
  var clr = score > 0.7 ? C.red : score > 0.5 ? C.amber : C.green;
  return (
    <div style={{display:"flex",alignItems:"center",gap:7}}>
      <div style={{width:64,height:5,background:C.surface,borderRadius:4,overflow:"hidden"}}>
        <div style={{width:(score*100)+"%",height:"100%",background:clr,borderRadius:4,
          transition:"width .3s ease"}} />
      </div>
      <span style={{color:clr,fontSize:11,fontWeight:700}}>{Math.round(score*100)}%</span>
    </div>  );
}

// -- DASHBOARD
var COMPLIANCE_ITEMS = [
  {id:"epf",   cat:"monthly", name:"EPF Contribution",      ref:"Form A",    dayDue:15, portal:"i-Akaun Majikan", color:"#059669", desc:"EPF employer + employee contribution due by 15th monthly"},
  {id:"socso", cat:"monthly", name:"SOCSO + EIS",            ref:"Borang 8A", dayDue:15, portal:"PERKESO Portal",  color:"#0EA5C9", desc:"SOCSO and EIS contributions due by 15th monthly"},
  {id:"pcb",   cat:"monthly", name:"PCB / MTD",              ref:"CP39",      dayDue:15, portal:"MyTax (LHDN)",    color:"#7C3AED", desc:"PCB/MTD remittance to LHDN due by 15th monthly"},
  {id:"hrdf",  cat:"monthly", name:"HRDF Levy",              ref:"",          dayDue:15, portal:"HRD Corp",        color:"#D97706", desc:"1% HRDF levy for employers with 10+ employees, due 15th"},
  {id:"formEA",cat:"annual",  name:"Borang EA / EC",         ref:"EA",        monthDue:2, dayDue:28, portal:"Issue to staff", color:"#DC2626", desc:"Issue Borang EA to all employees by 28 Feb (s83 Employment Act)"},
  {id:"formE", cat:"annual",  name:"Borang E",               ref:"Form E",    monthDue:3, dayDue:31, portal:"MyTax (LHDN)",   color:"#EC4899", desc:"Employer Return (Borang E) to LHDN by 31 Mar"},
  {id:"cp8d",  cat:"annual",  name:"CP8D (e-Data PCB)",      ref:"CP8D",      monthDue:3, dayDue:31, portal:"MyTax (LHDN)",   color:"#EC4899", desc:"Submit CP8D data file with Form E by 31 Mar"},
  {id:"cp22",  cat:"event",   name:"CP22 - New Employee",    ref:"CP22",      dayDue:30, portal:"LHDN",            color:"#64748B", desc:"Notify LHDN within 30 days of new employee starting"},
  {id:"cp22a", cat:"event",   name:"CP22A - Resignation",    ref:"CP22A",     dayDue:30, portal:"LHDN",            color:"#64748B", desc:"Notify LHDN 30 days BEFORE employee ceases employment"},
];

var kpiData = [
  {label:"Total Headcount",value:"247",sub:"+3 this month",icon:<Users size={18}/>,color:C.accent,bg:C.accentL},
  {label:"Monthly Payroll",value:"RM 1.24M",sub:"+2.1% vs last",icon:<DollarSign size={18}/>,color:C.green,bg:C.greenL},
  {label:"Pending Leaves",value:"18",sub:"Awaiting approval",icon:<Umbrella size={18}/>,color:C.amber,bg:C.amberL},
  {label:"Pending Claims",value:"32",sub:"RM 12,450 total",icon:<Receipt size={18}/>,color:C.purple,bg:C.purpleL},
  {label:"AI Risk Alerts",value:"3",sub:"Needs urgent review",icon:<AlertTriangle size={18}/>,color:C.red,bg:C.redL},
  {label:"EPF Due In",value:"5 days",sub:"RM 136,400 payable",icon:<FileText size={18}/>,color:C.amber,bg:C.amberL},
];
var aiAlerts = [
  {type:"Salary Anomaly",sev:"HIGH",desc:"Rajesh Kumar salary increased 35% - exceeds 30% threshold",score:0.87},
  {type:"Duplicate Claim",sev:"HIGH",desc:"C003 duplicate receipt detected - same amount on 06/06 & 06/07",score:0.94},
  {type:"PCB Under-Deduction",sev:"MEDIUM",desc:"Lim Wei Ting projected annual tax gap: RM 1,240",score:0.61},
];
var statutory = [
  {name:"EPF (KWSP)",ref:"Form A",due:"2025-06-15",amount:"RM 136,400",status:"Pending",portal:"i-Akaun Majikan"},
  {name:"SOCSO",ref:"Borang 8A",due:"2025-06-15",amount:"RM 7,350",status:"Pending",portal:"EzHASIL"},
  {name:"EIS",ref:"Borang IS",due:"2025-06-15",amount:"RM 2,470",status:"Pending",portal:"SOCSO Portal"},
  {name:"PCB (MTD)",ref:"CP39",due:"2025-06-15",amount:"RM 98,800",status:"Pending",portal:"MyTax"},
  {name:"HRDF Levy",ref:"Borang HRDF",due:"2025-06-30",amount:"RM 1,235",status:"Pending",portal:"HRD Corp"},
];


function Dashboard(props) {
  var today = new Date();
  var yr = today.getFullYear();
  var mo = today.getMonth();
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  var [compStatus, setCompStatus] = useState({});
  var toggleDone = function(id) {
    setCompStatus(function(prev){
      var u = Object.assign({},prev);
      u[id] = !prev[id];
      return u;
    });
  };

  var daysUntil = function(targetMo, targetDay) {
    var d = new Date(yr, targetMo, targetDay);
    if (d < today) d = new Date(yr + 1, targetMo, targetDay);
    return Math.ceil((d - today) / 86400000);
  };
  var daysUntilMonthly = function(day) {
    var d = new Date(yr, mo, day);
    if (d < today) d = new Date(yr, mo + 1, day);
    return Math.ceil((d - today) / 86400000);
  };
  var urgColor = function(days) { return days <= 0 ? "#DC2626" : days <= 5 ? "#DC2626" : days <= 10 ? "#D97706" : days <= 20 ? "#0EA5C9" : "#059669"; };
  var urgBg    = function(days) { return days <= 5 ? "#FEF2F2" : days <= 10 ? "#FFFBEB" : days <= 20 ? "#EFF6FF" : "#F0FDF4"; };

  var overdueCount = COMPLIANCE_ITEMS.filter(function(dl){
    if (dl.cat==="event") return false;
    var id = dl.cat==="annual" ? dl.id+"-"+yr : dl.id+"-"+yr+"-"+(mo+1);
    if (compStatus[id]) return false;
    var days = dl.cat==="annual" ? daysUntil(dl.monthDue-1,dl.dayDue) : daysUntilMonthly(dl.dayDue);
    return days <= 0;
  }).length;
  var urgentCount = COMPLIANCE_ITEMS.filter(function(dl){
    if (dl.cat==="event") return false;
    var id = dl.cat==="annual" ? dl.id+"-"+yr : dl.id+"-"+yr+"-"+(mo+1);
    if (compStatus[id]) return false;
    var days = dl.cat==="annual" ? daysUntil(dl.monthDue-1,dl.dayDue) : daysUntilMonthly(dl.dayDue);
    return days > 0 && days <= 7;
  }).length;
  var doneCount = COMPLIANCE_ITEMS.filter(function(dl){
    if (dl.cat==="event") return false;
    var id = dl.cat==="annual" ? dl.id+"-"+yr : dl.id+"-"+yr+"-"+(mo+1);
    return compStatus[id];
  }).length;

  return (
    <div>
      <SectionHead title="Command Center" sub={"HRCloud Malaysia - "+MON[mo]+" "+yr} />

      {overdueCount === 0 && urgentCount === 0 && (
        <div style={{padding:"11px 16px",background:C.greenL,border:"1px solid "+C.green+"40",
          borderRadius:12,marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <CheckCircle size={15} color={C.green}/>
          <div style={{color:C.green,fontWeight:700,fontSize:13}}>All compliance deadlines on track</div>
          <span style={S.ts11}>({doneCount} filed this period)</span>
        </div>
      )}
      {(overdueCount > 0 || urgentCount > 0) && (
        <div style={{padding:"12px 16px",background:"#FFF1F2",border:"1px solid #E5374A40",borderRadius:12,marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <AlertTriangle size={15} color={C.red}/>
            <span style={{color:C.red,fontWeight:800,fontSize:14}}>Compliance Action Required</span>
            {overdueCount > 0 && <span style={{background:C.red,color:"#fff",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5}}>{overdueCount} OVERDUE</span>}
            {urgentCount > 0 && <span style={{background:C.amber,color:"#fff",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5}}>{urgentCount} DUE SOON</span>}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:22}}>
        {kpiData.map(function(k,i){return(
          <div key={i} className="card-hover" style={{
            background:C.card,border:"1px solid "+C.border,borderRadius:16,
            padding:"20px 22px",cursor:"default",
            boxShadow:"0 1px 3px rgba(79,110,247,.05), 0 4px 12px rgba(13,18,38,.04)",
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div style={{width:42,height:42,borderRadius:12,background:k.bg,
                display:"flex",alignItems:"center",justifyContent:"center",color:k.color}}>
                {k.icon}
              </div>
              <span style={{background:k.bg,color:k.color,fontSize:10,fontWeight:700,
                padding:"3px 8px",borderRadius:5,letterSpacing:"0.04em"}}>
                {k.sub}
              </span>
            </div>
            <div style={{color:k.color,fontSize:28,fontWeight:800,letterSpacing:"-0.5px",lineHeight:1}}>{k.value}</div>
            <div style={{color:C.ts,fontSize:12,fontWeight:500,marginTop:5}}>{k.label}</div>
          </div>        );})}
      </div>

      <Card style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <div style={{width:10,height:10,background:"#DC2626",borderRadius:2,flexShrink:0}} />
          <span style={{color:C.tp,fontWeight:800,fontSize:15}}>Statutory Compliance Timeline</span>
          <span style={S.ts12}>- action required before deadlines</span>
        </div>

        <div style={{marginBottom:14}}>
          <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:8,paddingBottom:4,borderBottom:"1px solid "+C.border}}>MONTHLY RECURRING - Due 15th Every Month</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {COMPLIANCE_ITEMS.filter(function(d){return d.cat==="monthly";}).map(function(dl){
              var days = daysUntilMonthly(dl.dayDue);
              var done = compStatus[dl.id+"-"+yr+"-"+(mo+1)];
              var uc = done ? C.green : urgColor(days); var ub = done ? C.greenL : urgBg(days);
              return(
                <div key={dl.id} style={{background:ub,border:"1.5px solid "+uc+"44",borderRadius:10,padding:"12px 14px",borderLeft:"4px solid "+uc,opacity:done?0.85:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                    <div style={{color:C.tp,fontWeight:700,fontSize:12,lineHeight:1.3}}>{dl.name}</div>
                    <span style={{background:done?C.green:uc,color:"#fff",fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:5}}>{done?"DONE":days<=0?"OVR":days+"d"}</span>
                  </div>
                  {dl.ref ? <div style={{color:C.ts,fontSize:10,marginBottom:4}}>{dl.ref}</div> : null}
                  <div style={{color:C.ts,fontSize:9,lineHeight:1.4}}>{dl.desc}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                    <div style={{color:uc,fontSize:9,fontWeight:700}}>{dl.portal}</div>
                    <button onClick={function(){toggleDone(dl.id+"-"+yr+"-"+(mo+1));}} style={{background:done?C.green:C.surface,color:done?"#fff":C.ts,border:"1px solid "+(done?C.green:C.border),borderRadius:5,padding:"2px 8px",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{done?"Undo":"Mark Done"}</button>
                  </div>
                </div>              );
            })}
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:8,paddingBottom:4,borderBottom:"1px solid "+C.border}}>ANNUAL DEADLINES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {COMPLIANCE_ITEMS.filter(function(d){return d.cat==="annual";}).map(function(dl){
              var days = daysUntil(dl.monthDue - 1, dl.dayDue);
              var done = compStatus[dl.id+"-"+yr];
              var uc = done ? C.green : urgColor(days); var ub = done ? C.greenL : urgBg(days);
              return(
                <div key={dl.id} style={{background:ub,border:"1.5px solid "+uc+"44",borderRadius:10,padding:"12px 14px",borderLeft:"4px solid "+uc,opacity:done?0.85:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                    <div style={S.tp12b}>{dl.name}</div>
                    <span style={{background:done?C.green:uc,color:"#fff",fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:5}}>{done?"FILED":days<=0?"OVR":days+"d"}</span>
                  </div>
                  <div style={{color:C.ts,fontSize:10,marginBottom:4}}>Due {dl.dayDue} {MON[dl.monthDue-1]} {yr} {dl.ref ? "- "+dl.ref : ""}</div>
                  <div style={{color:C.ts,fontSize:9,lineHeight:1.4}}>{dl.desc}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                    {dl.portal ? <div style={{color:uc,fontSize:9,fontWeight:700}}>{dl.portal}</div> : <div />}
                    <button onClick={function(){toggleDone(dl.id+"-"+yr);}} style={{background:done?C.green:C.surface,color:done?"#fff":C.ts,border:"1px solid "+(done?C.green:C.border),borderRadius:5,padding:"2px 8px",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{done?"Undo":"Mark Filed"}</button>
                  </div>
                </div>              );
            })}
          </div>
        </div>

        <div>
          <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:8,paddingBottom:4,borderBottom:"1px solid "+C.border}}>EVENT-BASED (triggered on employee change)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {COMPLIANCE_ITEMS.filter(function(d){return d.cat==="event";}).map(function(dl){
              return(
                <div key={dl.id} style={{background:C.surface,border:"1.5px solid "+C.border,borderRadius:10,padding:"12px 14px",borderLeft:"4px solid "+dl.color}}>
                  <div style={{color:C.tp,fontWeight:700,fontSize:12,marginBottom:4}}>{dl.name}</div>
                  <div style={{color:C.ts,fontSize:10,marginBottom:4}}>{dl.ref} - within {dl.dayDue} days of event</div>
                  <div style={{color:C.ts,fontSize:9,lineHeight:1.4}}>{dl.desc}</div>
                  <div style={{marginTop:5,color:dl.color,fontSize:9,fontWeight:700}}>{dl.portal}</div>
                </div>              );
            })}
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.red,flexShrink:0}} />
            <span style={S.tp14b}>AI Risk Alerts</span>
            <Chip text="3 active" c={C.red} />
          </div>
          {aiAlerts.map(function(a,i){return(
            <div key={i} style={{borderLeft:"3px solid "+(a.sev==="HIGH"?C.red:C.amber),paddingLeft:12,marginBottom:14,paddingBottom:14,borderBottom:i<aiAlerts.length-1?"1px solid "+C.border+"55":"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={S.tp13b}>{a.type}</span>
                <StatusChip s={a.sev} />
              </div>
              <div style={{color:C.ts,fontSize:12,marginBottom:6,lineHeight:1.5}}>{a.desc}</div>
              <RiskBar score={a.score} />
            </div>          );})}
        </Card>
        <Card>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.amber,flexShrink:0}} />
            <span style={S.tp14b}>Statutory Contributions</span>
          </div>
          {statutory.map(function(s,i){return(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<statutory.length-1?"1px solid "+C.border+"55":"none"}}>
              <div>
                <div style={{color:C.tp,fontSize:13,fontWeight:600}}>{s.name}</div>
                <div style={{color:C.ts,fontSize:11,marginTop:2}}>Due {s.due} - {s.amount}</div>
              </div>
              <div style={S.rowG8}>
                <span style={S.ts11}>{s.portal}</span>
                <StatusChip s={s.status} />
              </div>
            </div>          );})}
        </Card>
      </div>
      <Card>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:C.accent,flexShrink:0}} />
          <span style={S.tp14b}>Payroll Snapshot</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
          {[["Gross Payroll","RM 1,240,000",C.tp,C.accentL],["EPF Employer","RM 136,400",C.green,C.greenL],["SOCSO + EIS","RM 9,820",C.accent,C.accentL],["PCB (MTD)","RM 98,800",C.purple,C.purpleL],["Net to Bank","RM 994,980",C.amber,C.amberL]].map(function(item,i){return(
            <div key={i} style={{background:item[3],borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
              <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"0.7px",marginBottom:6}}>{item[0].toUpperCase()}</div>
              <div style={{color:item[2],fontWeight:800,fontSize:15}}>{item[1]}</div>
            </div>          );})}
        </div>
      </Card>
    </div>  );
}

// -- EMPLOYEE MODULE
function FLabel(p) { return <label style={S.ts11b}>{p.children}</label>; }
function FGrid(p) { return <div style={{display:"grid",gridTemplateColumns:"repeat("+(p.cols||2)+",1fr)",gap:12,marginBottom:8}}>{p.children}</div>; }
function FSec(p) { return <div style={{color:C.accent,fontWeight:700,fontSize:12,margin:"20px 0 12px",paddingBottom:8,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:7,letterSpacing:"0.04em",textTransform:"uppercase"}}>{p.icon} {p.title}</div>; }
function FieldRow(p) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid "+C.border+"55"}}>
      <span style={{color:C.ts,fontSize:12,flexShrink:0,minWidth:140}}>{p.label}</span>
      {p.children || <span style={{color:C.tp,fontSize:13,fontWeight:600,textAlign:"right"}}>{p.value||"--"}</span>}
    </div>  );
}
function FInput(p) {
  return <input type={p.type||"text"} value={p.value||""} onChange={p.onChange} placeholder={p.placeholder||""} style={Object.assign({},p.inputStyle,{marginBottom:0})} />;
}
function FSelect(p) {
  return (
    <select value={p.value||""} onChange={p.onChange} style={Object.assign({},p.selectStyle,{marginBottom:0})}>
      <option value="">-- Select --</option>
      {(p.options||[]).map(function(o) { return <option key={o} value={o}>{o}</option>; })}
    </select>  );
}
function RatesCard(p) {
  return (
    <Card>
      <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>{p.title}</div>
      {(p.rows||[]).map(function(item,i) {
        return (
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:i<p.rows.length-1?"1px solid "+C.border+"55":"none"}}>
            <span style={{color:C.ts,fontSize:12,flex:1,paddingRight:12}}>{item[0]}</span>
            <span style={{color:p.valueColor||C.green,fontWeight:700,fontSize:12,textAlign:"right"}}>{item[1]}</span>
          </div>        );
      })}
    </Card>  );
}
function EmployeeConfigModule(props) {
  var config = props.config;
  var setConfig = props.setConfig;
  var leaveConfig = props.leaveConfig;
  var setLeaveConfig = props.setLeaveConfig;

  var payrollConfig    = props.payrollConfig    || INIT_PAYROLL_CONFIG;
  var setPayrollConfig = props.setPayrollConfig || function(){};

  var [tab, setTab] = useState("departments");
  var [inp, setInp] = useState("");
  var [err, setErr] = useState("");
  var [ltab, setLtab] = useState("types");
  var [pytab, setPytab] = useState("cutoff");
  var [tierEdit, setTierEdit] = useState(null);
  var [tierForm, setTierForm] = useState({});
  var [ltForm, setLtForm] = useState(null);
  var [ltEdit, setLtEdit] = useState(null);
  var [phForm, setPhForm] = useState(null);
  var [entEdit, setEntEdit] = useState(null);
  var [entForm, setEntForm] = useState({});

  var LEFT_TABS = [
    ["departments","Departments","Dept"],
    ["grades","Grades","Grade"],
    ["roles","Roles","Role"],
    ["employmentTypes","Employment Types","EmpT"],
    ["statuses","Statuses","Stat"],
    ["leave","Leave Entitlement","Leave"],
    ["payroll","Payroll Settings","Pay"],
  ];

  var LEAVE_SUBTABS = [
    ["types","Leave Types"],
    ["entitlements","Entitlements"],
    ["holidays","Public Holidays"],
    ["policy","Leave Policy"],
  ];

  var isLeaveTab    = tab === "leave";
  var isPayrollTab  = tab === "payroll";
  var isSimpleTab   = !isLeaveTab && !isPayrollTab;
  var items = isSimpleTab ? (config[tab] || []) : [];
  var curTab = LEFT_TABS.find(function(t) { return t[0] === tab; }) || LEFT_TABS[0];

  var setPC = function(key, val) {
    setPayrollConfig(function(prev) {
      var u = Object.assign({}, prev);
      u[key] = val;
      return u;
    });
  };

  var saveTier = function() {
    setPayrollConfig(function(prev) {
      var newTiers = prev.latePenaltyTiers.map(function(t, i) {
        return i === tierEdit ? Object.assign({}, tierForm) : t;
      });
      return Object.assign({}, prev, {latePenaltyTiers: newTiers});
    });
    setTierEdit(null);
  };

  var addItem = function() {
    var val = inp.trim();
    if (!val) { setErr("Please enter a value."); return; }
    if (config[tab].indexOf(val) > -1) { setErr("Already exists."); return; }
    setErr("");
    setConfig(function(prev) {
      var updated = Object.assign({}, prev);
      updated[tab] = prev[tab].concat([val]);
      return updated;
    });
    setInp("");
  };

  var removeItem = function(item) {
    setConfig(function(prev) {
      var updated = Object.assign({}, prev);
      updated[tab] = prev[tab].filter(function(x) { return x !== item; });
      return updated;
    });
  };
  var openNewLT = function() {
    setLtEdit(null);
    setLtForm({id:"",name:"",paid:true,carry:false,maxCarry:0,requireDoc:false,color:"#0EA5C9"});
  };

  var openEditLT = function(lt) {
    setLtEdit(lt.id);
    setLtForm(Object.assign({},lt));
  };

  var saveLT = function() {
    if (!ltForm.name.trim()) return;
    setLeaveConfig(function(prev) {
      var updated = Object.assign({}, prev);
      if (ltEdit) {
        updated.leaveTypes = prev.leaveTypes.map(function(t) { return t.id===ltEdit ? Object.assign({},ltForm) : t; });
      } else {
        var newId = "LT"+Date.now().toString().slice(-4);
        updated.leaveTypes = prev.leaveTypes.concat([Object.assign({},ltForm,{id:newId})]);
      }
      return updated;
    });
    setLtForm(null);
    setLtEdit(null);
  };

  var removeLT = function(id) {
    setLeaveConfig(function(prev) {
      var updated = Object.assign({}, prev);
      updated.leaveTypes = prev.leaveTypes.filter(function(t) { return t.id !== id; });
      return updated;
    });
  };
  var openNewPH = function() {
    setPhForm({id:"",date:"",name:"",type:"National",compulsory:true});
  };

  var savePH = function() {
    if (!phForm.name.trim() || !phForm.date) return;
    setLeaveConfig(function(prev) {
      var updated = Object.assign({}, prev);
      var newId = "ph"+Date.now().toString().slice(-4);
      var existing = prev.publicHolidays.find(function(h){return h.id===phForm.id;});
      if (existing) {
        updated.publicHolidays = prev.publicHolidays.map(function(h){return h.id===phForm.id?Object.assign({},phForm):h;});
      } else {
        updated.publicHolidays = prev.publicHolidays.concat([Object.assign({},phForm,{id:newId})]).sort(function(a,b){return a.date>b.date?1:-1;});
      }
      return updated;
    });
    setPhForm(null);
  };

  var removePH = function(id) {
    setLeaveConfig(function(prev) {
      var updated = Object.assign({}, prev);
      updated.publicHolidays = prev.publicHolidays.filter(function(h){return h.id!==id;});
      return updated;
    });
  };
  var openEntEdit = function(empTypeIdx, tierIdx) {
    var tier = leaveConfig.entitlements[empTypeIdx].tiers[tierIdx];
    setEntEdit({empTypeIdx:empTypeIdx, tierIdx:tierIdx});
    setEntForm(Object.assign({},tier));
  };

  var saveEnt = function() {
    setLeaveConfig(function(prev) {
      var updated = Object.assign({}, prev);
      var ents = prev.entitlements.map(function(e,ei) {
        if (ei !== entEdit.empTypeIdx) return e;
        var newTiers = e.tiers.map(function(t,ti) {
          if (ti !== entEdit.tierIdx) return t;
          return Object.assign({},entForm);
        });
        return Object.assign({},e,{tiers:newTiers});
      });
      updated.entitlements = ents;
      return updated;
    });
    setEntEdit(null);
  };
  var setPolicy = function(key, val) {
    setLeaveConfig(function(prev) {
      var newPolicy = Object.assign({},prev.policy);
      newPolicy[key] = val;
      return Object.assign({},prev,{policy:newPolicy});
    });
  };

  var LT_COLORS = ["#0EA5C9","#059669","#7C3AED","#EC4899","#3B82F6","#DC2626","#D97706","#94A3B8","#0369A1","#047857"];

  return (
    <div>
      <SectionHead title="HR Configuration" sub="Manage departments, grades, roles, leave types and payroll settings" />
      <div style={{display:"flex",gap:16}}>
        {/* Left sidebar tabs */}
        <div style={{width:180,flexShrink:0}}>
          <Card noPad style={{overflow:"hidden"}}>
            {LEFT_TABS.map(function(t,i) {
              var active = tab === t[0];
              return (
                <button key={t[0]} onClick={function(){setTab(t[0]);setInp("");setErr("");}}
                  style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"11px 14px",
                    background:active?"linear-gradient(135deg,#0EA5C9,#0369A1)":"transparent",
                    color:active?"#fff":C.ts,border:"none",fontSize:12,fontWeight:active?700:500,
                    textAlign:"left",cursor:"pointer",fontFamily:"inherit",
                    borderBottom:i<LEFT_TABS.length-1?"1px solid "+C.border+"55":"none"}}>
                  {t[1]}
                </button>              );
            })}
          </Card>
        </div>

        {/* Main content */}
        <div style={{flex:1}}>
          {isSimpleTab && (
            <Card>
              <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:16}}>{curTab[1]}</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input value={inp} onChange={function(e){setInp(e.target.value);setErr("");}}
                  onKeyDown={function(e){if(e.key==="Enter")addItem();}}
                  placeholder={"Add new " + curTab[2] + "..."}
                  style={{flex:1,padding:"8px 12px",border:"1.5px solid "+C.border,borderRadius:8,
                    fontSize:13,fontFamily:"inherit",color:C.tp,background:C.bg}} />
                <Btn c={C.green} onClick={addItem}><Plus size={14}/> Add</Btn>
              </div>
              {err && <div style={{color:C.red,fontSize:12,marginBottom:12}}>{err}</div>}
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {items.map(function(item) {
                  return (
                    <div key={item} style={{display:"flex",alignItems:"center",gap:6,
                      background:C.accentL,border:"1.5px solid "+C.accent+"44",
                      borderRadius:20,padding:"5px 12px"}}>
                      <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{item}</span>
                      <button onClick={function(){removeItem(item);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:C.red,
                          display:"flex",alignItems:"center",padding:0,lineHeight:1}}>
                        <X size={13}/>
                      </button>
                    </div>                  );
                })}
                {items.length === 0 && <div style={S.ts13}>No items yet. Add one above.</div>}
              </div>
            </Card>
          )}

          {isLeaveTab && (
            <div>
              {/* Leave sub-tabs */}
              <div style={{display:"flex",gap:4,marginBottom:16}}>
                {LEAVE_SUBTABS.map(function(s) {
                  var a = ltab===s[0];
                  return (
                    <button key={s[0]} onClick={function(){setLtab(s[0]);}}
                      style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid "+(a?C.accent:C.border),
                        background:a?C.accentL:"transparent",color:a?C.accent:C.ts,
                        fontWeight:a?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                      {s[1]}
                    </button>                  );
                })}
              </div>

              {ltab === "types" && (
                <Card>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={S.tp15b}>Leave Types</div>
                    <Btn c={C.green} onClick={openNewLT}><Plus size={13}/> Add Type</Btn>
                  </div>
                  {ltForm && (
                    <div style={{background:C.surface,borderRadius:12,padding:16,marginBottom:16}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                        <div>
                          <FLabel>Name</FLabel>
                          <input value={ltForm.name||""} onChange={function(e){setLtForm(function(f){return Object.assign({},f,{name:e.target.value});});}}
                            style={{width:"100%",padding:"7px 10px",border:"1.5px solid "+C.border,borderRadius:7,fontSize:13,fontFamily:"inherit"}} />
                        </div>
                        <div>
                          <FLabel>Color</FLabel>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                            {LT_COLORS.map(function(c) {
                              return <div key={c} onClick={function(){setLtForm(function(f){return Object.assign({},f,{color:c});});}}
                                style={{width:20,height:20,borderRadius:4,background:c,cursor:"pointer",
                                  border:ltForm.color===c?"2px solid #000":"2px solid transparent"}} />;
                            })}
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:16,marginBottom:10}}>
                        {[["paid","Paid Leave"],["carry","Carry Forward"],["requireDoc","Require Document"]].map(function(opt) {
                          return (
                            <label key={opt[0]} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:C.tp,cursor:"pointer"}}>
                              <input type="checkbox" checked={!!ltForm[opt[0]]} onChange={function(e){
                                var k=opt[0],v=e.target.checked;
                                setLtForm(function(f){return Object.assign({},f,{[k]:v});});
                              }} />
                              {opt[1]}
                            </label>                          );
                        })}
                      </div>
                      <div style={S.rowG8}>
                        <Btn c={C.green} onClick={saveLT}><Check size={13}/> Save</Btn>
                        <Btn c={C.ts} onClick={function(){setLtForm(null);setLtEdit(null);}}>Cancel</Btn>
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {(leaveConfig.leaveTypes||[]).map(function(lt) {
                      return (
                        <div key={lt.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                          padding:"10px 14px",background:C.surface,borderRadius:10,
                          borderLeft:"4px solid "+lt.color}}>
                          <div style={S.rowG10}>
                            <div style={{width:10,height:10,borderRadius:2,background:lt.color}} />
                            <span style={{color:C.tp,fontWeight:600,fontSize:13}}>{lt.name}</span>
                            <span style={S.ts11}>{lt.paid?"Paid":"Unpaid"}{lt.carry?" · Carry Fwd":""}{lt.requireDoc?" · Doc Req":""}</span>
                          </div>
                          <div style={S.rowG6}>
                            <button onClick={function(){openEditLT(lt);}}
                              style={{background:"none",border:"none",cursor:"pointer",color:C.accent,display:"flex",alignItems:"center"}}><Pencil size={14}/></button>
                            <button onClick={function(){removeLT(lt.id);}}
                              style={{background:"none",border:"none",cursor:"pointer",color:C.red,display:"flex",alignItems:"center"}}><Trash2 size={14}/></button>
                          </div>
                        </div>                      );
                    })}
                  </div>
                </Card>
              )}

              {ltab === "entitlements" && (
                <Card>
                  <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:14}}>Leave Entitlements by Employment Type</div>
                  {(leaveConfig.entitlements||[]).map(function(ent, ei) {
                    return (
                      <div key={ent.empType} style={{marginBottom:20}}>
                        <div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:8}}>{ent.empType}</div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {ent.tiers.map(function(tier, ti) {
                            var isEditing = entEdit && entEdit.empTypeIdx===ei && entEdit.tierIdx===ti;
                            return (
                              <div key={ti} style={{background:C.surface,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                                {isEditing ? (
                                  <div style={{display:"flex",gap:8,alignItems:"center",flex:1}}>
                                    <input type="number" value={entForm.daysFrom} onChange={function(e){setEntForm(function(f){return Object.assign({},f,{daysFrom:+e.target.value});});}}
                                      style={{width:60,padding:"4px 8px",border:"1.5px solid "+C.border,borderRadius:6,fontSize:12}} placeholder="From yr" />
                                    <input type="number" value={entForm.days} onChange={function(e){setEntForm(function(f){return Object.assign({},f,{days:+e.target.value});});}}
                                      style={{width:60,padding:"4px 8px",border:"1.5px solid "+C.border,borderRadius:6,fontSize:12}} placeholder="Days" />
                                    <Btn c={C.green} onClick={saveEnt}><Check size={12}/></Btn>
                                    <Btn c={C.ts} onClick={function(){setEntEdit(null);}}>✕</Btn>
                                  </div>
                                ) : (
                                  <>
                                    <span style={{color:C.tp,fontSize:13}}>{tier.daysFrom === 0 ? "Below 1 year" : tier.daysFrom + "+ years"}: <strong>{tier.days} days</strong></span>
                                    <button onClick={function(){openEntEdit(ei,ti);}}
                                      style={{background:"none",border:"none",cursor:"pointer",color:C.accent,display:"flex",alignItems:"center"}}><Pencil size={14}/></button>
                                  </>
                                )}
                              </div>                            );
                          })}
                        </div>
                      </div>                    );
                  })}
                </Card>
              )}

              {ltab === "holidays" && (
                <Card>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={S.tp15b}>Public Holidays</div>
                    <Btn c={C.green} onClick={openNewPH}><Plus size={13}/> Add Holiday</Btn>
                  </div>
                  {phForm && (
                    <div style={{background:C.surface,borderRadius:12,padding:16,marginBottom:16}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                        <div><FLabel>Date</FLabel>
                          <input type="date" value={phForm.date||""} onChange={function(e){setPhForm(function(f){return Object.assign({},f,{date:e.target.value});});}}
                            style={{width:"100%",padding:"7px 10px",border:"1.5px solid "+C.border,borderRadius:7,fontSize:13,fontFamily:"inherit"}} /></div>
                        <div><FLabel>Name</FLabel>
                          <input value={phForm.name||""} onChange={function(e){setPhForm(function(f){return Object.assign({},f,{name:e.target.value});});}}
                            style={{width:"100%",padding:"7px 10px",border:"1.5px solid "+C.border,borderRadius:7,fontSize:13,fontFamily:"inherit"}} /></div>
                      </div>
                      <div style={S.rowG8}>
                        <Btn c={C.green} onClick={savePH}><Check size={13}/> Save</Btn>
                        <Btn c={C.ts} onClick={function(){setPhForm(null);}}>Cancel</Btn>
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {(leaveConfig.publicHolidays||[]).map(function(h) {
                      return (
                        <div key={h.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                          padding:"9px 14px",background:C.surface,borderRadius:8}}>
                          <div>
                            <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{h.name}</span>
                            <span style={{color:C.ts,fontSize:12,marginLeft:12}}>{h.date}</span>
                          </div>
                          <div style={S.rowG6}>
                            <button onClick={function(){setPhForm(Object.assign({},h));}}
                              style={{background:"none",border:"none",cursor:"pointer",color:C.accent,display:"flex",alignItems:"center"}}><Pencil size={14}/></button>
                            <button onClick={function(){removePH(h.id);}}
                              style={{background:"none",border:"none",cursor:"pointer",color:C.red,display:"flex",alignItems:"center"}}><Trash2 size={14}/></button>
                          </div>
                        </div>                      );
                    })}
                    {(leaveConfig.publicHolidays||[]).length===0 && <div style={S.ts13}>No public holidays configured.</div>}
                  </div>
                </Card>
              )}

              {ltab === "policy" && (
                <Card>
                  <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:16}}>Leave Policy Settings</div>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {[
                      {key:"allowHalfDay",label:"Allow Half-Day Leave",type:"check"},
                      {key:"requireApproval",label:"Require Manager Approval",type:"check"},
                      {key:"advanceNoticeDays",label:"Advance Notice (days)",type:"number"},
                      {key:"maxConsecutiveDays",label:"Max Consecutive Days",type:"number"},
                    ].map(function(f) {
                      var val = (leaveConfig.policy||{})[f.key];
                      return (
                        <div key={f.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                          padding:"10px 14px",background:C.surface,borderRadius:8}}>
                          <span style={{color:C.tp,fontSize:13,fontWeight:500}}>{f.label}</span>
                          {f.type==="check" ? (
                            <input type="checkbox" checked={!!val} onChange={function(e){setPolicy(f.key,e.target.checked);}}
                              style={{width:16,height:16,cursor:"pointer"}} />
                          ) : (
                            <input type="number" value={val||0} onChange={function(e){setPolicy(f.key,+e.target.value);}}
                              style={{width:70,padding:"5px 8px",border:"1.5px solid "+C.border,borderRadius:6,fontSize:13,textAlign:"center"}} />
                          )}
                        </div>                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}

          {isPayrollTab && (
            <div>
              <div style={{display:"flex",gap:4,marginBottom:16}}>
                {[["cutoff","Pay Cutoff"],["rates","EPF/SOCSO"],["late","Late Policy"],["misc","Misc"]].map(function(s) {
                  var a = pytab===s[0];
                  return (
                    <button key={s[0]} onClick={function(){setPytab(s[0]);}}
                      style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid "+(a?C.accent:C.border),
                        background:a?C.accentL:"transparent",color:a?C.accent:C.ts,
                        fontWeight:a?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                      {s[1]}
                    </button>                  );
                })}
              </div>

              {pytab === "cutoff" && (
                <Card>
                  <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:16}}>Payroll Cutoff & Period</div>
                  <div style={S.g2s}>
                    {[
                      {key:"cutoffDay",label:"Cutoff Day of Month",type:"number"},
                      {key:"payDay",label:"Pay Day",type:"number"},
                      {key:"hrEmail",label:"HR Email",type:"text"},
                      {key:"leaveApprover",label:"Leave Approver",type:"text"},
                    ].map(function(f) {
                      return (
                        <div key={f.key}>
                          <FLabel>{f.label}</FLabel>
                          <input type={f.type} value={payrollConfig[f.key]||""} onChange={function(e){setPC(f.key,f.type==="number"?+e.target.value:e.target.value);}}
                            style={{width:"100%",padding:"8px 12px",border:"1.5px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:"inherit",color:C.tp,background:C.bg}} />
                        </div>                      );
                    })}
                  </div>
                </Card>
              )}

              {pytab === "rates" && (
                <Card>
                  <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:16}}>Statutory Rates</div>
                  <div style={S.g2s}>
                    {[
                      {key:"epfEe",label:"EPF Employee (%)"},
                      {key:"epfEr",label:"EPF Employer (%)"},
                      {key:"hrdfRate",label:"HRDF Rate (%)"},
                    ].map(function(f) {
                      return (
                        <div key={f.key}>
                          <FLabel>{f.label}</FLabel>
                          <input type="number" step="0.1" value={payrollConfig[f.key]||""} onChange={function(e){setPC(f.key,+e.target.value);}}
                            style={{width:"100%",padding:"8px 12px",border:"1.5px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:"inherit",color:C.tp,background:C.bg}} />
                        </div>                      );
                    })}
                  </div>
                </Card>
              )}

              {pytab === "late" && (
                <Card>
                  <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:16}}>Late Arrival Policy</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                    <div>
                      <FLabel>Grace Period (minutes)</FLabel>
                      <input type="number" value={payrollConfig.gracePeriodMin||0} onChange={function(e){setPC("gracePeriodMin",+e.target.value);}}
                        style={{width:"100%",padding:"8px 12px",border:"1.5px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:"inherit",color:C.tp,background:C.bg}} />
                    </div>
                    <div>
                      <FLabel>Deduction Method</FLabel>
                      <select value={payrollConfig.lateDeductMethod||"hourly"} onChange={function(e){setPC("lateDeductMethod",e.target.value);}}
                        style={{width:"100%",padding:"8px 12px",border:"1.5px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:"inherit",color:C.tp,background:C.bg}}>
                        <option value="hourly">Hourly Rate</option>
                        <option value="daily">Daily Rate</option>
                        <option value="tiered">Tiered</option>
                        <option value="none">No Deduction</option>
                      </select>
                    </div>
                  </div>
                  {(payrollConfig.latePenaltyTiers||[]).map(function(tier, i) {
                    return (
                      <div key={i} style={{background:C.surface,borderRadius:8,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                        {tierEdit===i ? (
                          <>
                            <input type="number" value={tierForm.minMin||0} onChange={function(e){setTierForm(function(f){return Object.assign({},f,{minMin:+e.target.value});});}}
                              style={{width:70,padding:"5px 8px",border:"1.5px solid "+C.border,borderRadius:6,fontSize:12}} placeholder="Min min" />
                            <span style={S.ts12}>–</span>
                            <input type="number" value={tierForm.maxMin||0} onChange={function(e){setTierForm(function(f){return Object.assign({},f,{maxMin:+e.target.value});});}}
                              style={{width:70,padding:"5px 8px",border:"1.5px solid "+C.border,borderRadius:6,fontSize:12}} placeholder="Max min" />
                            <span style={S.ts12}>mins →</span>
                            <input type="number" value={tierForm.deductHours||0} onChange={function(e){setTierForm(function(f){return Object.assign({},f,{deductHours:+e.target.value});});}}
                              style={{width:70,padding:"5px 8px",border:"1.5px solid "+C.border,borderRadius:6,fontSize:12}} placeholder="Hrs ded" />
                            <span style={S.ts12}>hrs deducted</span>
                            <Btn c={C.green} onClick={saveTier}><Check size={12}/></Btn>
                            <Btn c={C.ts} onClick={function(){setTierEdit(null);}}>✕</Btn>
                          </>
                        ) : (
                          <>
                            <span style={{color:C.tp,fontSize:13,flex:1}}>{tier.minMin}–{tier.maxMin} mins → {tier.deductHours}h deducted</span>
                            <button onClick={function(){setTierEdit(i);setTierForm(Object.assign({},tier));}}
                              style={{background:"none",border:"none",cursor:"pointer",color:C.accent,display:"flex",alignItems:"center"}}><Pencil size={14}/></button>
                          </>
                        )}
                      </div>                    );
                  })}
                </Card>
              )}

              {pytab === "misc" && (
                <Card>
                  <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:16}}>Miscellaneous Settings</div>
                  <div style={S.g2s}>
                    {[
                      {key:"otMultiplier",label:"OT Multiplier",type:"number",step:"0.5"},
                      {key:"otMultiplierPH",label:"OT on PH Multiplier",type:"number",step:"0.5"},
                      {key:"workingDaysPerMonth",label:"Working Days/Month",type:"number"},
                      {key:"workingHoursPerDay",label:"Working Hours/Day",type:"number"},
                    ].map(function(f) {
                      return (
                        <div key={f.key}>
                          <FLabel>{f.label}</FLabel>
                          <input type="number" step={f.step||"1"} value={payrollConfig[f.key]||""} onChange={function(e){setPC(f.key,+e.target.value);}}
                            style={{width:"100%",padding:"8px 12px",border:"1.5px solid "+C.border,borderRadius:8,fontSize:13,fontFamily:"inherit",color:C.tp,background:C.bg}} />
                        </div>                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>  );
}

function EmployeeModule(props) {
  var employees = props.employees; var setEmployees = props.setEmployees;
  var hrConfig = props.hrConfig || {};
  var [sel, setSel] = useState(null);
  var [profileTab, setProfileTab] = useState("personal");
  var [showForm, setShowForm] = useState(false);
  var [editTarget, setEditTarget] = useState(null);
  var [form, setForm] = useState({});
  var [search, setSearch] = useState("");

  var emp = sel ? employees.find(function(e) { return e.id === sel; }) : null;
  var setF = function(k, v) { setForm(function(f) { var u = Object.assign({}, f); u[k] = v; return u; }); };

  var filtered = employees.filter(function(e) {
    var q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.nric.includes(q) ||
      e.dept.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
  });

  var openNew = function() {
    var newId = "E" + String(employees.length + 1).padStart(3, "0");
    setForm(Object.assign({}, EMPTY_EMP, {id: newId}));
    setEditTarget(null); setShowForm(true); setSel(null);
  };
  var openEdit = function(e) { setForm(Object.assign({}, e)); setEditTarget(e.id); setShowForm(true); };
  var saveForm = function() {
    if (editTarget) {
      setEmployees(function(prev) { return prev.map(function(e) { return e.id === editTarget ? Object.assign({}, form) : e; }); });
    } else {
      setEmployees(function(prev) { return prev.concat([Object.assign({}, form)]); });
    }
    setShowForm(false); setEditTarget(null); setSel(form.id);
  };

  var STATES = ["W.P. Kuala Lumpur","W.P. Putrajaya","Selangor","Johor","Kedah","Kelantan","Melaka","Negeri Sembilan","Pahang","Perak","Perlis","Pulau Pinang","Sabah","Sarawak","Terengganu"];
  var BANKS = ["Maybank","CIMB","Public Bank","RHB","Hong Leong Bank","AmBank","BSN","Bank Rakyat","Affin Bank","Alliance Bank","Bank Islam","OCBC","UOB","Standard Chartered","HSBC"];

  return (
    <div>
      <SectionHead title="Employee Master" sub="Full personal, statutory and bank records"
        action={<Btn c={C.green} onClick={openNew}>+ Add Employee</Btn>} />

      {showForm && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.45)",zIndex:1000,
          display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"40px 20px"}}>
          <div style={{background:C.card,borderRadius:18,width:"100%",maxWidth:820,
            boxShadow:"0 24px 80px rgba(14,165,201,.18)",padding:32,position:"relative"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              marginBottom:24,paddingBottom:16,borderBottom:"2px solid "+C.border}}>
              <div>
                <div style={{color:C.tp,fontWeight:800,fontSize:18}}>{editTarget?"Edit Employee":"New Employee"}</div>
                <div style={{color:C.ts,fontSize:12,marginTop:3}}>{editTarget?"Editing: "+form.name:"Fill in all required fields"}</div>
              </div>
              <Btn c={C.ts} onClick={function(){setShowForm(false);}}>Cancel</Btn>
            </div>
            <div style={{maxHeight:"70vh",overflowY:"auto",paddingRight:8}}>
              <FSec title="Personal Information" icon={<User size={14}/>} />
              <FGrid>
                <div><FLabel>Full Name *</FLabel><FInput value={form["name"]||""} onChange={function(e){setF("name",e.target.value);}} placeholder="e.g. Ahmad Farid bin Azman" /></div>
                <div><FLabel>Preferred Name</FLabel><FInput value={form["preferredName"]||""} onChange={function(e){setF("preferredName",e.target.value);}} /></div>
                <div><FLabel>NRIC No. *</FLabel><FInput value={form["nric"]||""} onChange={function(e){setF("nric",e.target.value);}} placeholder="850101-14-1234" /></div>
                <div><FLabel>Date of Birth</FLabel><FInput value={form["dob"]||""} onChange={function(e){setF("dob",e.target.value);}} type="date" /></div>
                <div><FLabel>Gender</FLabel><FSelect value={form["gender"]||""} onChange={function(e){setF("gender",e.target.value);}} options={["Male","Female"]} /></div>
                <div><FLabel>Nationality</FLabel><FSelect value={form["nationality"]||""} onChange={function(e){setF("nationality",e.target.value);}} options={["Malaysian","Non-Malaysian"]} /></div>
                <div><FLabel>Race</FLabel><FSelect value={form["race"]||""} onChange={function(e){setF("race",e.target.value);}} options={["Malay","Chinese","Indian","Others"]} /></div>
                <div><FLabel>Religion</FLabel><FSelect value={form["religion"]||""} onChange={function(e){setF("religion",e.target.value);}} options={["Islam","Christianity","Buddhism","Hinduism","Others"]} /></div>
                <div><FLabel>Marital Status</FLabel><FSelect value={form["maritalStatus"]||""} onChange={function(e){setF("maritalStatus",e.target.value);}} options={["Single","Married","Divorced","Widowed"]} /></div>
                <div><FLabel>No. of Children</FLabel><FInput value={form["children"]||""} onChange={function(e){setF("children",parseInt(e.target.value)||0);}} type="number" placeholder="0" /></div>
              </FGrid>
              <FSec title="Employment" icon="💼" />
              <FGrid>
                <div style={{gridColumn:"1 / -1"}}>
                  <div style={{background:"#EFF6FF",border:"2px solid #1E40AF",borderRadius:10,padding:"12px 16px",display:"flex",gap:16,alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <FLabel><span style={{color:"#1E40AF"}}>Employee No.</span> <span style={{color:"#DC2626",fontSize:10}}>* Required on confirmation of employment</span></FLabel>
                      <FInput value={form["empNo"]||""} onChange={function(e){setF("empNo",e.target.value);}} placeholder="e.g. EMP001 or HR-2025-001" />
                      <div style={{color:"#64748B",fontSize:10,marginTop:4}}>Employee number is used across payroll, Borang E, Borang EA, and all HR reports. Assign once employment is confirmed.</div>
                    </div>
                    <div style={{flex:1}}>
                      <FLabel>Work Email Address</FLabel>
                      <FInput value={form["email"]||""} onChange={function(e){setF("email",e.target.value);}} placeholder="name@company.com.my" />
                      <div style={{color:"#64748B",fontSize:10,marginTop:4}}>Used for leave notifications, payslip delivery, and system access.</div>
                    </div>
                  </div>
                </div>
                <div><FLabel>Work Email</FLabel><FInput value={form["workEmail"]||""} onChange={function(e){setF("workEmail",e.target.value);}} placeholder="e.g. name@company.com.my" /></div>
                <div><FLabel>Department</FLabel><FSelect value={form["dept"]||""} onChange={function(e){setF("dept",e.target.value);}} options={["Finance","HR","IT","Sales","Operations","Management"]} /></div>
                <div><FLabel>Position</FLabel><FInput value={form["position"]||""} onChange={function(e){setF("position",e.target.value);}} /></div>
                <div><FLabel>Grade</FLabel><FSelect value={form["grade"]||""} onChange={function(e){setF("grade",e.target.value);}} options={["G1","G2","G3","G4","G5","G6","M1","M2"]} /></div>
                <div><FLabel>Role</FLabel><FSelect value={form["role"]||""} onChange={function(e){setF("role",e.target.value);}} options={["Staff","Manager","HR Manager","Payroll Admin","Super Admin"]} /></div>
                <div><FLabel>Employment Type</FLabel><FSelect value={form["employmentType"]||""} onChange={function(e){setF("employmentType",e.target.value);}} options={["Permanent","Contract","Internship","Part-time"]} /></div>
                <div><FLabel>Status</FLabel><FSelect value={form["status"]||""} onChange={function(e){setF("status",e.target.value);}} options={["Active","Probation","Resigned","Terminated"]} /></div>
                <div><FLabel>Join Date</FLabel><FInput value={form["joinDate"]||""} onChange={function(e){setF("joinDate",e.target.value);}} type="date" /></div>
                <div><FLabel>Confirmation Date</FLabel><FInput value={form["confirmDate"]||""} onChange={function(e){setF("confirmDate",e.target.value);}} type="date" /></div>
              </FGrid>
              <FSec title="Compensation" icon={<DollarSign size={14}/>} />
              <FGrid>
                <div><FLabel>Basic Salary (RM)</FLabel><FInput value={form["basic"]||""} onChange={function(e){setF("basic",e.target.value);}} type="number" /></div>
                <div><FLabel>Age</FLabel><FInput value={form["age"]||""} onChange={function(e){setF("age",e.target.value);}} type="number" /></div>
                <div><FLabel>Support Allowance (RM)</FLabel><FInput value={form["supportAllow"]||""} onChange={function(e){setF("supportAllow",e.target.value);}} type="number" /></div>
                <div><FLabel>Travel Allowance (RM)</FLabel><FInput value={form["travelAllow"]||""} onChange={function(e){setF("travelAllow",e.target.value);}} type="number" /></div>
                <div><FLabel>Other Allowance (RM)</FLabel><FInput value={form["otherAllow"]||""} onChange={function(e){setF("otherAllow",e.target.value);}} type="number" /></div>
                <div><FLabel>Other Allowance Label</FLabel><FInput value={form["otherAllowLabel"]||""} onChange={function(e){setF("otherAllowLabel",e.target.value);}} placeholder="e.g. Sales Incentive" /></div>
              </FGrid>
              <FSec title="Statutory" icon={<FileText size={14}/>} />
              <FGrid>
                <div><FLabel>EPF No.</FLabel><FInput value={form["epfNo"]||""} onChange={function(e){setF("epfNo",e.target.value);}} /></div>
                <div><FLabel>SOCSO No.</FLabel><FInput value={form["socsoNo"]||""} onChange={function(e){setF("socsoNo",e.target.value);}} /></div>
                <div><FLabel>SOCSO Category</FLabel><FSelect value={form["socsoCat"]||""} onChange={function(e){setF("socsoCat",e.target.value);}} options={["1","2"]} /></div>
                <div><FLabel>EIS No.</FLabel><FInput value={form["eisNo"]||""} onChange={function(e){setF("eisNo",e.target.value);}} /></div>
                <div><FLabel>Tax File No.</FLabel><FInput value={form["taxNo"]||""} onChange={function(e){setF("taxNo",e.target.value);}} /></div>
                <div><FLabel>LHDN Branch</FLabel><FInput value={form["taxBranch"]||""} onChange={function(e){setF("taxBranch",e.target.value);}} /></div>
              </FGrid>
              <FSec title="CP38 — LHDN Instalment Deduction" icon={<AlertCircle size={14}/>} />
              <div style={{background:"#FEF3C7",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#92400E"}}>
                CP38 is issued by LHDN/IRB instructing the employer to deduct a fixed monthly instalment from the employee's salary and remit directly to LHDN. Enter the IRB order details below — deduction will apply automatically each payroll within the active date range.
              </div>
              <FGrid>
                <div><FLabel>CP38 Reference No.</FLabel><FInput value={form["cp38Ref"]||""} onChange={function(e){setF("cp38Ref",e.target.value);}} placeholder="e.g. CP38/2024/001234" /></div>
                <div><FLabel>Monthly Instalment (RM)</FLabel><FInput type="number" value={form["cp38Amount"]||""} onChange={function(e){setF("cp38Amount",parseFloat(e.target.value)||0);}} placeholder="0.00" /></div>
                <div><FLabel>Instalment From</FLabel><FInput type="date" value={form["cp38DateFrom"]||""} onChange={function(e){setF("cp38DateFrom",e.target.value);}} /></div>
                <div><FLabel>Instalment To</FLabel><FInput type="date" value={form["cp38DateTo"]||""} onChange={function(e){setF("cp38DateTo",e.target.value);}} /></div>
              </FGrid>
              <FSec title="Children Details — LHDN Tax Relief" icon={<Users size={14}/>} />
              <div style={{background:"#EFF6FF",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#1E40AF",lineHeight:1.6}}>
                Enter each child's details for accurate LHDN PCB calculation. Relief amounts follow LHDN YA 2024 rules: below-18 (RM 2,000), 18-23 in tertiary (RM 8,000), disabled child (RM 8,000 + RM 8,000 if studying).
              </div>
              {(function(){
                var kids = form.childrenDetails || [];
                var addKid = function() {
                  setF("childrenDetails", kids.concat([{id:Date.now(),name:"",age:"",gender:"",studyLevel:"none",institution:"",disabled:false}]));
                };
                var updateKid = function(idx, field, val) {
                  var next = kids.map(function(k,i){ return i===idx ? Object.assign({},k,{[field]:val}) : k; });
                  setF("childrenDetails", next);
                };
                var removeKid = function(idx) {
                  setF("childrenDetails", kids.filter(function(_,i){return i!==idx;}));
                };
                return (
                  <div>
                    {kids.map(function(kid, idx) {
                      return (
                        <div key={kid.id||idx} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1.5px solid "+C.border}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                            <span style={{color:C.tp,fontWeight:700,fontSize:12}}>Child {idx+1}</span>
                            <button onClick={function(){removeKid(idx);}} style={{background:C.redL,color:C.red,border:"none",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                            <div><FLabel>Full Name</FLabel><FInput value={kid.name||""} onChange={function(e){updateKid(idx,"name",e.target.value);}} placeholder="Child's full name" /></div>
                            <div><FLabel>Age</FLabel><FInput type="number" value={kid.age||""} onChange={function(e){updateKid(idx,"age",e.target.value);}} placeholder="e.g. 12" /></div>
                            <div>
                              <FLabel>Education Level</FLabel>
                              <select value={kid.studyLevel||"none"} onChange={function(e){updateKid(idx,"studyLevel",e.target.value);}}
                                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid "+C.border,fontSize:12,fontFamily:"inherit",background:"#fff",color:C.tp,marginBottom:8}}>
                                <option value="none">Not studying</option>
                                <option value="primary">Primary School (Sekolah Rendah)</option>
                                <option value="secondary">Secondary School / SPM / STPM</option>
                                <option value="university">University / College / Diploma (full-time)</option>
                              </select>
                            </div>
                            <div><FLabel>School / Institution Name</FLabel><FInput value={kid.institution||""} onChange={function(e){updateKid(idx,"institution",e.target.value);}} placeholder="e.g. SMK Damansara" /></div>
                            <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:20}}>
                              <input type="checkbox" id={"kid-dis-"+idx} checked={kid.disabled||false} onChange={function(e){updateKid(idx,"disabled",e.target.checked);}} style={{width:16,height:16,cursor:"pointer"}} />
                              <label htmlFor={"kid-dis-"+idx} style={{color:C.tp,fontSize:12,cursor:"pointer"}}>OKU / Disabled child <span style={{color:C.ts,fontSize:10}}>(+RM 8,000 extra relief)</span></label>
                            </div>
                            <div style={{background:C.accentL,borderRadius:8,padding:"8px 10px",fontSize:11,color:C.accent,fontWeight:600}}>
                              Relief: RM {(function(){
                                var a=parseInt(kid.age)||0; var d=kid.disabled; var l=kid.studyLevel||"none";
                                if(d) return l==="university"?"16,000":"8,000";
                                if(a<=18) return "2,000";
                                if(a<=23&&(l==="university"||l==="secondary")) return "8,000";
                                return "0";
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={addKid} style={{width:"100%",padding:"10px",background:C.accentL,color:C.accent,border:"1.5px dashed "+C.accent+"66",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
                      + Add Child
                    </button>
                  </div>
                );
              })()}

              <FSec title="PCB / MTD Relief Claims — LHDN YA 2024" icon={<DollarSign size={14}/>} />
              <div style={{background:"#F0FDF4",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#166534",lineHeight:1.6}}>
                These reliefs are used to calculate the correct monthly PCB/MTD deduction per LHDN MYtax rules. Enter the <strong>annual</strong> amount claimable per item.
              </div>
              <FGrid>
                <div>
                  <FLabel>Spouse Relief</FLabel>
                  <div style={{display:"flex",gap:10,marginBottom:8}}>
                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer"}}>
                      <input type="checkbox" checked={form.spouseRelief||false} onChange={function(e){setF("spouseRelief",e.target.checked);}} /> Spouse relief (RM 4,000)
                    </label>
                  </div>
                  <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer"}}>
                    <input type="checkbox" checked={form.spouseDisabled||false} onChange={function(e){setF("spouseDisabled",e.target.checked);}} disabled={!form.spouseRelief} /> Disabled spouse (+RM 3,500)
                  </label>
                </div>
                <div>
                  <FLabel>Self (OKU / Disability)</FLabel>
                  <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer",marginBottom:8}}>
                    <input type="checkbox" checked={form.selfDisabled||false} onChange={function(e){setF("selfDisabled",e.target.checked);}} /> Self disabled / OKU (+RM 6,000)
                  </label>
                  <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer"}}>
                    <input type="checkbox" checked={form.selfStudying||false} onChange={function(e){setF("selfStudying",e.target.checked);}} /> Self further education (up to RM 7,000)
                  </label>
                </div>
                <div><FLabel>Life Insurance (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 3,000 (EPF+Life cap RM 7,000)</span></FLabel><FInput type="number" value={form.lifeInsurance||""} onChange={function(e){setF("lifeInsurance",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>Medical Insurance (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 3,000</span></FLabel><FInput type="number" value={form.medicalInsurance||""} onChange={function(e){setF("medicalInsurance",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>Medical — Self/Spouse/Child (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 10,000</span></FLabel><FInput type="number" value={form.medicalSelf||""} onChange={function(e){setF("medicalSelf",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>Medical — Parents (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 8,000</span></FLabel><FInput type="number" value={form.medicalParents||""} onChange={function(e){setF("medicalParents",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>Private Retirement Scheme — PRS (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 3,000</span></FLabel><FInput type="number" value={form.privateRetirement||""} onChange={function(e){setF("privateRetirement",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>SSP — Skim Simpanan Pendidikan (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 3,000</span></FLabel><FInput type="number" value={form.sspRelief||""} onChange={function(e){setF("sspRelief",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>Childcare / Kindergarten Fees (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 3,000</span></FLabel><FInput type="number" value={form.childcareRelief||""} onChange={function(e){setF("childcareRelief",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>Breastfeeding Equipment (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 1,000</span></FLabel><FInput type="number" value={form.breastfeeding||""} onChange={function(e){setF("breastfeeding",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>Disability Equipment (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 6,000</span></FLabel><FInput type="number" value={form.disabilityEquipment||""} onChange={function(e){setF("disabilityEquipment",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>Sports Equipment / Gym (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 1,000</span></FLabel><FInput type="number" value={form.sportEquipment||""} onChange={function(e){setF("sportEquipment",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>Domestic Tourism (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 1,000</span></FLabel><FInput type="number" value={form.domesticTourism||""} onChange={function(e){setF("domesticTourism",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
                <div><FLabel>EV Charging Facility (RM/yr) <span style={{color:C.ts,fontSize:10}}>max RM 2,500</span></FLabel><FInput type="number" value={form.electricVehicleCharge||""} onChange={function(e){setF("electricVehicleCharge",parseFloat(e.target.value)||0);}} placeholder="0" /></div>
              </FGrid>

              <FSec title="Bank Details" icon={<CreditCard size={14}/>} />
              <FGrid>
                <div><FLabel>Bank Name</FLabel><FSelect value={form["bankName"]||""} onChange={function(e){setF("bankName",e.target.value);}} options={BANKS} /></div>
                <div><FLabel>Account Number</FLabel><FInput value={form["bankAcc"]||""} onChange={function(e){setF("bankAcc",e.target.value);}} /></div>
                <div><FLabel>Account Holder Name</FLabel><FInput value={form["bankHolder"]||""} onChange={function(e){setF("bankHolder",e.target.value);}} /></div>
              </FGrid>
              <FSec title="Address" icon="🏠" />
              <FGrid cols={1}>
                <div><FLabel>Address Line 1</FLabel><FInput value={form["addr1"]||""} onChange={function(e){setF("addr1",e.target.value);}} /></div>
                <div><FLabel>Address Line 2</FLabel><FInput value={form["addr2"]||""} onChange={function(e){setF("addr2",e.target.value);}} /></div>
              </FGrid>
              <FGrid>
                <div><FLabel>City</FLabel><FInput value={form["city"]||""} onChange={function(e){setF("city",e.target.value);}} /></div>
                <div><FLabel>Postcode</FLabel><FInput value={form["postcode"]||""} onChange={function(e){setF("postcode",e.target.value);}} /></div>
                <div><FLabel>State</FLabel><FSelect value={form["state"]||""} onChange={function(e){setF("state",e.target.value);}} options={STATES} /></div>
                <div><FLabel>Country</FLabel><FInput value={form["country"]||""} onChange={function(e){setF("country",e.target.value);}} /></div>
              </FGrid>
              <FSec title="Emergency Contact" icon="🚨" />
              <FGrid>
                <div><FLabel>Contact Name</FLabel><FInput value={form["emerName"]||""} onChange={function(e){setF("emerName",e.target.value);}} /></div>
                <div><FLabel>Relationship</FLabel><FInput value={form["emerRel"]||""} onChange={function(e){setF("emerRel",e.target.value);}} /></div>
                <div><FLabel>Phone</FLabel><FInput value={form["emerPhone"]||""} onChange={function(e){setF("emerPhone",e.target.value);}} /></div>
                <div><FLabel>Alt Phone</FLabel><FInput value={form["emerPhone2"]||""} onChange={function(e){setF("emerPhone2",e.target.value);}} /></div>
              </FGrid>
            </div>
            <div style={{marginTop:24,paddingTop:16,borderTop:"2px solid "+C.border,display:"flex",justifyContent:"flex-end",gap:10}}>
              <Btn c={C.ts} onClick={function(){setShowForm(false);}}>Cancel</Btn>
              <Btn c={C.green} onClick={saveForm}>Save Employee</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16}}>
        <div>
          <input value={search} onChange={function(e){setSearch(e.target.value);}}
            placeholder="Search name, NRIC, dept..."
            style={Object.assign({},inputStyle,{marginBottom:12,fontSize:12})} />
          <Card noPad style={{overflow:"hidden"}}>
            {filtered.map(function(e,i) {
              return (
                <div key={e.id} onClick={function(){setSel(e.id); setProfileTab("personal");}}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",
                    background:sel===e.id?C.accentL:"transparent",
                    borderBottom:i<filtered.length-1?"1px solid "+C.border+"55":"none",
                    transition:"all .12s"}}>
                  <Avatar name={e.name} size={34} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:sel===e.id?C.accent:C.tp,fontWeight:700,fontSize:13,
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</div>
                    <div style={{color:C.ts,fontSize:11,marginTop:1}}>{e.dept} - {e.id}</div>
                  </div>
                  <StatusChip s={e.status} />
                </div>              );
            })}
          </Card>
        </div>

        {emp ? (
          <div>
            <Card style={S.mb12}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16,paddingBottom:16,borderBottom:"1px solid "+C.border}}>
                <Avatar name={emp.name} size={52} />
                <div style={{flex:1}}>
                  <div style={{color:C.tp,fontSize:16,fontWeight:800}}>{emp.name}</div>
                  <div style={{color:C.ts,fontSize:12,marginTop:2}}>{emp.position||emp.role} - {emp.dept}</div>
                  <div style={{marginTop:6,display:"flex",gap:6}}>
                    <StatusChip s={emp.status} />
                    <Chip text={emp.employmentType} c={C.accent} />
                  </div>
                </div>
                <Btn c={C.accent} onClick={function(){openEdit(emp);}}>Edit Profile</Btn>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[["personal","Personal"],["employment","Employment"],
                  ["statutory","Statutory"],["bank","Bank"],["emergency","Emergency"]].map(function(t) {
                  return (
                    <button key={t[0]} onClick={function(){setProfileTab(t[0]);}} style={{
                      background:profileTab===t[0]?C.accentL:"transparent",
                      color:profileTab===t[0]?C.accent:C.ts,
                      border:"1.5px solid "+(profileTab===t[0]?C.accent+"55":"transparent"),
                      borderRadius:7,padding:"6px 12px",fontSize:11,fontWeight:600,
                      cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
                    }}>
                      {t[1]}
                    </button>                  );
                })}
              </div>
            </Card>
            <Card>
              {profileTab === "personal" && (
                <div>
                  <FieldRow label="Full Name" value={emp.name} />
                  <FieldRow label="NRIC" value={emp.nric} />
                  <FieldRow label="Date of Birth" value={emp.dob} />
                  <FieldRow label="Gender" value={emp.gender} />
                  <FieldRow label="Nationality" value={emp.nationality} />
                  <FieldRow label="Race" value={emp.race} />
                  <FieldRow label="Religion" value={emp.religion} />
                  <FieldRow label="Marital Status" value={emp.maritalStatus} />
                  {emp.spouseName && <FieldRow label="Spouse Name" value={emp.spouseName} />}
                  <FieldRow label="No. of Children" value={String(emp.children||0)} />
                  {(emp.childrenDetails && emp.childrenDetails.length > 0) && (
                    <div style={{marginTop:10,marginBottom:6}}>
                      <div style={{color:C.ts,fontSize:11,fontWeight:700,marginBottom:6,letterSpacing:"0.5px"}}>CHILDREN DETAILS</div>
                      <div style={{borderRadius:10,overflow:"hidden",border:"1.5px solid "+C.border}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr style={{background:C.surface}}>
                              {["#","Name","Age","Education Level","Institution","OKU","LHDN Relief"].map(function(h,hi){
                                return <th key={h} style={{padding:"7px 10px",textAlign:hi>=5?"center":"left",color:C.ts,fontSize:10,fontWeight:700,borderBottom:"1px solid "+C.border}}>{h}</th>;
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {emp.childrenDetails.map(function(kid,ki){
                              var lvlLabel = {none:"Not studying",primary:"Primary School",secondary:"Secondary / SPM / STPM",university:"University / College / Diploma"}[kid.studyLevel||"none"]||"—";
                              var age = parseInt(kid.age)||0;
                              var d = kid.disabled; var l = kid.studyLevel||"none";
                              var relief = d ? (l==="university"?"RM 16,000":"RM 8,000") : age<=18 ? "RM 2,000" : (age<=23&&(l==="university"||l==="secondary")) ? "RM 8,000" : "—";
                              return (
                                <tr key={kid.id||ki} style={{borderBottom:"1px solid "+C.border+"44",background:ki%2===0?"transparent":"#F8FAFF"}}>
                                  <td style={{padding:"8px 10px",color:C.ts,fontSize:12,fontWeight:700}}>{ki+1}</td>
                                  <td style={{padding:"8px 10px",color:C.tp,fontWeight:600}}>{kid.name||"—"}</td>
                                  <td style={{padding:"8px 10px",color:C.ts,textAlign:"center"}}>{kid.age||"—"}</td>
                                  <td style={{padding:"8px 10px",color:C.tp}}>{lvlLabel}</td>
                                  <td style={{padding:"8px 10px",color:C.ts,fontSize:11}}>{kid.institution||"—"}</td>
                                  <td style={{padding:"8px 10px",textAlign:"center"}}>
                                    {kid.disabled
                                      ? <span style={{background:C.purpleL,color:C.purple,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>OKU</span>
                                      : <span style={{color:C.tm,fontSize:11}}>—</span>}
                                  </td>
                                  <td style={{padding:"8px 10px",textAlign:"center"}}>
                                    <span style={{background:C.greenL,color:C.green,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{relief}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{background:C.accentL,borderTop:"2px solid "+C.border}}>
                              <td colSpan={6} style={{padding:"8px 10px",color:C.accent,fontWeight:700,fontSize:11}}>Total Child Relief (LHDN)</td>
                              <td style={{padding:"8px 10px",textAlign:"center"}}>
                                <span style={{color:C.green,fontWeight:900,fontSize:12}}>RM {calcChildRelief(emp.childrenDetails).toLocaleString()}</span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                  <FieldRow label="Phone" value={emp.phone} />
                  <FieldRow label="Personal Email" value={emp.personalEmail} />
                  <FieldRow label="Work Email" value={emp.workEmail} />
                  <FieldRow label="Address" value={[emp.addr1,emp.addr2,emp.city,emp.postcode,emp.state].filter(Boolean).join(", ")} />
                </div>
              )}
              {profileTab === "employment" && (
                <div>
                  <FieldRow label="Employee ID" value={emp.id} />
                  <FieldRow label="Employee No." value={emp.empNo||"Not assigned yet"} />
                  <FieldRow label="Position" value={emp.position||emp.role} />
                  <FieldRow label="Department" value={emp.dept} />
                  <FieldRow label="Grade" value={emp.grade} />
                  <FieldRow label="Employment Type" value={emp.employmentType} />
                  <FieldRow label="Join Date" value={emp.joinDate} />
                  <FieldRow label="Confirmation Date" value={emp.confirmDate} />
                  <FieldRow label="Status"><StatusChip s={emp.status} /></FieldRow>
                  <div style={{marginTop:18,marginBottom:10,fontWeight:700,color:C.tp,fontSize:13}}>Salary and Allowances</div>
                  <FieldRow label="Basic Salary"><span style={{color:C.green,fontWeight:800,fontSize:15}}>RM {(emp.basic||0).toLocaleString()}</span></FieldRow>
                  {emp.travelAllow > 0 && <FieldRow label="Travel Allowance" value={"RM "+emp.travelAllow} />}
                  {emp.supportAllow > 0 && <FieldRow label="Support Allowance" value={"RM "+emp.supportAllow} />}
                  {emp.otherAllow > 0 && <FieldRow label={emp.otherAllowLabel||"Other Allowance"} value={"RM "+emp.otherAllow} />}
                  <div style={{marginTop:14,background:C.accentL,borderRadius:10,padding:"12px 14px"}}>
                    {(function() {
                      var totalAllow = (emp.supportAllow||0) + (emp.travelAllow||0) + (emp.otherAllow||0);
                      var gross = (emp.basic||0) + totalAllow;
                      var epf = getEpf(emp.basic||0, emp.age||35, null, null);
                      var socso = getSocso(emp.basic||0, emp.socsoCat==="2"?2:1);
                      var eis = getEis(emp.basic||0, emp.age||35);
                      var pcb = getPcb(emp.basic||0, {
                        spouseRelief:emp.spouseRelief||false, spouseDisabled:emp.spouseDisabled||false,
                        selfDisabled:emp.selfDisabled||false, selfStudying:emp.selfStudying||false,
                        educationFees:emp.educationFees||0, childrenDetails:emp.childrenDetails||[],
                        pcbChildren:parseInt(emp.pcbChildren)||0, epfEeAmt:epf.ee,
                        lifeInsurance:emp.lifeInsurance||0, medicalInsurance:emp.medicalInsurance||0,
                        medicalSelf:emp.medicalSelf||0, medicalParents:emp.medicalParents||0,
                        privateRetirement:emp.privateRetirement||0, sspRelief:emp.sspRelief||0,
                        childcareRelief:emp.childcareRelief||0, sportEquipment:emp.sportEquipment||0,
                        domesticTourism:emp.domesticTourism||0, electricVehicleCharge:emp.electricVehicleCharge||0,
                        disabilityEquipment:emp.disabilityEquipment||0, breastfeeding:emp.breastfeeding||0,
                      });
                      var net = gross - epf.ee - socso.ee - eis.ee - pcb.monthlyPCB;
                      return [
                        ["Gross Salary","RM "+gross.toLocaleString(),C.tp],
                        ["EPF Employee","RM "+epf.ee,C.green],
                        ["SOCSO Employee","RM "+socso.ee.toFixed(2),C.accent],
                        ["EIS Employee","RM "+eis.ee.toFixed(2),C.accent],
                        ["PCB (MTD)","RM "+pcb.monthlyPCB,C.purple],
                        ["Net Take-Home","RM "+net.toFixed(2),C.green],
                      ].map(function(item) {
                        return (
                          <div key={item[0]} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+C.border+"44"}}>
                            <span style={S.ts12}>{item[0]}</span>
                            <span style={{color:item[2],fontWeight:700,fontSize:13}}>{item[1]}</span>
                          </div>                        );
                      });
                    })()}
                  </div>
                </div>
              )}
              {profileTab === "statutory" && (
                <div>
                  <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"0.5px",marginBottom:8}}>STATUTORY NUMBERS</div>
                  <FieldRow label="EPF No." value={emp.epfNo} />
                  <FieldRow label="SOCSO No." value={emp.socsoNo} />
                  <FieldRow label="SOCSO Category"><Chip text={"Cat "+emp.socsoCat} c={C.accent} /></FieldRow>
                  <FieldRow label="EIS No." value={emp.eisNo} />
                  <FieldRow label="Tax File No." value={emp.taxNo} />
                  <FieldRow label="LHDN Branch" value={emp.taxBranch} />

                  {(emp.cp38Amount > 0) && (
                    <div style={{marginTop:14,background:C.amberL,borderRadius:10,padding:"12px 14px",border:"1.5px solid "+C.amber+"44"}}>
                      <div style={{color:C.amber,fontWeight:700,fontSize:12,marginBottom:8}}>⚡ CP38 — LHDN Instalment Order</div>
                      <FieldRow label="Reference No." value={emp.cp38Ref||"—"} />
                      <FieldRow label="Monthly Amount" value={"RM "+(emp.cp38Amount||0).toFixed(2)} />
                      <FieldRow label="Active From" value={emp.cp38DateFrom||"—"} />
                      <FieldRow label="Active Until" value={emp.cp38DateTo||"—"} />
                    </div>
                  )}

                  <div style={{marginTop:14,background:C.purpleL,borderRadius:10,padding:"12px 14px",border:"1.5px solid "+C.purple+"22"}}>
                    <div style={{color:C.purple,fontWeight:700,fontSize:12,marginBottom:10}}>PCB / MTD — LHDN Relief Summary (YA 2024)</div>
                    {(function(){
                      var items = [];
                      items.push(["Self Personal Relief","RM 9,000"]);
                      if (emp.selfDisabled) items.push(["Self OKU/Disabled","+RM 6,000"]);
                      if (emp.selfStudying) items.push(["Self Further Education","up to RM 7,000"]);
                      if (emp.spouseRelief) items.push(["Spouse Relief","RM 4,000"]);
                      if (emp.spouseRelief && emp.spouseDisabled) items.push(["Disabled Spouse","+RM 3,500"]);
                      var kids = emp.childrenDetails||[];
                      if (kids.length > 0) {
                        items.push(["Child Relief ("+kids.length+" child"+(kids.length!==1?"ren":"")+")", "RM "+calcChildRelief(kids).toLocaleString()]);
                      } else if (emp.pcbChildren > 0) {
                        items.push(["Child Relief ("+emp.pcbChildren+" child"+(emp.pcbChildren!==1?"ren":"")+")",
                          "RM "+((emp.pcbChildren||0)*2000).toLocaleString()]);
                      }
                      if (emp.lifeInsurance > 0) items.push(["Life Insurance","RM "+(emp.lifeInsurance).toLocaleString()+"/yr"]);
                      if (emp.medicalInsurance > 0) items.push(["Medical Insurance","RM "+(emp.medicalInsurance).toLocaleString()+"/yr"]);
                      if (emp.medicalSelf > 0) items.push(["Medical Self/Spouse/Child","RM "+(emp.medicalSelf).toLocaleString()+"/yr"]);
                      if (emp.medicalParents > 0) items.push(["Medical Parents","RM "+(emp.medicalParents).toLocaleString()+"/yr"]);
                      if (emp.privateRetirement > 0) items.push(["PRS","RM "+(emp.privateRetirement).toLocaleString()+"/yr"]);
                      if (emp.sspRelief > 0) items.push(["SSP","RM "+(emp.sspRelief).toLocaleString()+"/yr"]);
                      if (emp.childcareRelief > 0) items.push(["Childcare Fees","RM "+(emp.childcareRelief).toLocaleString()+"/yr"]);
                      if (emp.sportEquipment > 0) items.push(["Sport Equipment","RM "+(emp.sportEquipment).toLocaleString()+"/yr"]);
                      if (emp.domesticTourism > 0) items.push(["Domestic Tourism","RM "+(emp.domesticTourism).toLocaleString()+"/yr"]);
                      if (emp.electricVehicleCharge > 0) items.push(["EV Charging","RM "+(emp.electricVehicleCharge).toLocaleString()+"/yr"]);
                      if (emp.disabilityEquipment > 0) items.push(["Disability Equipment","RM "+(emp.disabilityEquipment).toLocaleString()+"/yr"]);
                      if (emp.breastfeeding > 0) items.push(["Breastfeeding Equipment","RM "+(emp.breastfeeding).toLocaleString()+"/yr"]);
                      return items.map(function(row,i){
                        return (
                          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+C.border+"33"}}>
                            <span style={{color:C.ts,fontSize:11}}>{row[0]}</span>
                            <span style={{color:C.purple,fontWeight:600,fontSize:11}}>{row[1]}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
              {profileTab === "bank" && (
                <div>
                  <div style={{background:C.accentL,border:"1.5px solid "+C.accent+"44",borderRadius:12,padding:"18px 20px",marginBottom:16}}>
                    <div style={{color:C.ts,fontSize:11,fontWeight:700,marginBottom:8}}>PRIMARY ACCOUNT</div>
                    <div style={{color:C.tp,fontSize:20,fontWeight:900,marginBottom:4}}>{emp.bankName}</div>
                    <div style={{color:C.ts,fontSize:14,letterSpacing:2,marginBottom:4}}>{(emp.bankAcc||"").replace(/(.{4})/g,"$1 ").trim()}</div>
                    <div style={{color:C.tp,fontSize:13,fontWeight:600}}>{emp.bankHolder}</div>
                  </div>
                  <FieldRow label="Bank Name" value={emp.bankName} />
                  <FieldRow label="Account Number" value={emp.bankAcc} />
                  <FieldRow label="Account Holder" value={emp.bankHolder} />
                </div>
              )}
              {profileTab === "emergency" && (
                <div>
                  <div style={{background:C.redL,border:"1.5px solid "+C.red+"33",borderRadius:12,
                    padding:"16px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
                    <span style={{fontSize:32}}>🚨</span>
                    <div>
                      <div style={{color:C.tp,fontSize:15,fontWeight:800}}>{emp.emerName}</div>
                      <div style={{color:C.ts,fontSize:12,marginTop:2}}>{emp.emerRel} - {emp.emerPhone}</div>
                    </div>
                  </div>
                  <FieldRow label="Contact Name" value={emp.emerName} />
                  <FieldRow label="Relationship" value={emp.emerRel} />
                  <FieldRow label="Phone" value={emp.emerPhone} />
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Card style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:320}}>
            <div style={{fontSize:56,marginBottom:16}}>👤</div>
            <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:6}}>Select an employee</div>
            <div style={{color:C.ts,fontSize:13,textAlign:"center",maxWidth:260,lineHeight:1.6}}>
              Click any employee on the left to view their complete profile
            </div>
          </Card>
        )}
      </div>
    </div>  );
}

// -- PAYROLL MODULE
var PAYROLL_BATCHES_INIT = [
  {id:"PAY-2025-06",period:"June 2025",month:"2025-06",wd:26,status:"Draft",created:"2025-06-28",by:"Ahmad Farid"},
  {id:"PAY-2025-05",period:"May 2025",month:"2025-05",wd:26,status:"Confirmed",created:"2025-05-28",by:"Ahmad Farid"},
  {id:"PAY-2025-04",period:"April 2025",month:"2025-04",wd:22,status:"Paid",created:"2025-04-28",by:"Ahmad Farid"},
  {id:"PAY-2025-03",period:"March 2025",month:"2025-03",wd:26,status:"Paid",created:"2025-03-28",by:"Ahmad Farid"},
  {id:"PAY-2025-02",period:"February 2025",month:"2025-02",wd:20,status:"Paid",created:"2025-02-26",by:"Ahmad Farid"},
  {id:"PAY-2025-01",period:"January 2025",month:"2025-01",wd:26,status:"Paid",created:"2025-01-28",by:"Ahmad Farid"},
];

// All available columns definition

var ALL_COLS = [
  {k:"empNo",    label:"Emp No",     fixed:true,  align:"left",  color:C.ts},
  {k:"name",     label:"Employee",   fixed:true,  align:"left",  color:C.tp},
  {k:"dept",     label:"Dept",       fixed:true,  align:"left",  color:C.ts},
  {k:"basic",    label:"Basic",      fixed:false, align:"right", color:C.ts},
  {k:"otAmt",    label:"OT",         fixed:false, align:"right", color:C.amber},
  {k:"incentive",label:"Commission", fixed:false, align:"right", color:C.amber},
  {k:"travel",   label:"Travel Alw", fixed:false, align:"right", color:C.ts},
  {k:"other",    label:"Other Alw",  fixed:false, align:"right", color:C.ts},
  {k:"grossTotal",label:"Gross",     fixed:false, align:"right", color:C.green},
  {k:"unpaidAmt",label:"Absent Ded", fixed:false, align:"right", color:C.red},
  {k:"lateAmt",  label:"Late Ded",   fixed:false, align:"right", color:C.red},
  {k:"epfEe",    label:"EPF EE",     fixed:false, align:"right", color:C.green},
  {k:"socsoEe",  label:"SOCSO EE",   fixed:false, align:"right", color:C.accent},
  {k:"eisEe",    label:"EIS EE",     fixed:false, align:"right", color:C.accent},
  {k:"pcb",      label:"PCB",        fixed:false, align:"right", color:C.purple},
  {k:"hrdf",     label:"HRDF",       fixed:false, align:"right", color:C.amber},
  {k:"totalDeduct",label:"Total Ded",fixed:false, align:"right", color:C.red},
  {k:"netTotal", label:"Net Pay",    fixed:false, align:"right", color:C.green},
  {k:"epfEr",    label:"EPF ER",     fixed:false, align:"right", color:C.green},
  {k:"socsoEr",  label:"SOCSO ER",   fixed:false, align:"right", color:C.accent},
  {k:"eisEr",    label:"EIS ER",     fixed:false, align:"right", color:C.accent},
];
var DEFAULT_VIS = ["name","dept","basic","grossTotal","unpaidAmt","lateAmt","epfEe","socsoEe","eisEe","pcb","netTotal","epfEr","socsoEr","eisEr"];
var NUM_KEYS = ["basic","otAmt","incentive","travel","other","grossTotal","unpaidAmt","lateAmt","epfEe","epfEr","socsoEe","socsoEr","eisEe","eisEr","pcb","hrdf","totalDeduct","netTotal"];

// -- Drilldown Overview Tab
function DrillOverview(p) {
  var r = p.r; var emp = p.emp; var wd = p.wd;
  var realWd  = r.schedWd        || wd;
  var realHph = r.schedHrsPerDay || 8;
  var dailyRate  = r.dailyRate  || parseFloat((r.basic / realWd).toFixed(4));
  var hourlyRate = r.hourlyRate || parseFloat((r.basic / (realWd * realHph)).toFixed(4));
  var schedSrc = r.fromSchedule;
  return (
    <div>
      {schedSrc && (
        <div style={{background:C.greenL,borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:C.green,fontWeight:700,fontSize:11}}>From Schedule</span>
          {[
            ["Working Days", realWd+" days"],
            ["Work Hours", r.schedStart+"-"+r.schedEnd],
            ["Net hrs/day", realHph.toFixed(1)+"h"],
            ["Daily Rate", "RM "+dailyRate.toFixed(4)],
            ["Hourly Rate", "RM "+hourlyRate.toFixed(4)],
          ].map(function(item,i){
            return (
              <div key={i} style={{display:"flex",gap:4,alignItems:"center"}}>
                <span style={S.ts10}>{item[0]}:</span>
                <span style={{color:C.green,fontWeight:700,fontSize:11}}>{item[1]}</span>
              </div>            );
          })}
        </div>
      )}
      <div style={S.g2m}>
        <div>
          <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:10}}>Employee Info</div>
          {[
            ["Full Name", r.name],
            ["Department", r.dept],
            ["Position", emp.position||emp.role||"--"],
            ["Employee ID", r.empId],
            ["Age", r.age+" years"],
            ["Join Date", emp.joinDate||"--"],
            ["Bank", (emp.bankName||"--")+" ****"+(emp.bankAcc||"").slice(-4)],
          ].map(function(item,i) {
            return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+C.border+"44"}}>
                <span style={S.ts12}>{item[0]}</span>
                <span style={{color:C.tp,fontWeight:500,fontSize:12}}>{item[1]}</span>
              </div>            );
          })}
        </div>
        <div>
          <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:10}}>Payroll Summary</div>
          {[
            ["Basic Salary","RM "+r.basic.toFixed(2),C.tp,true],
            ["Working Days",realWd+" days"+(schedSrc?" (sched)":""),C.accent,false],
            ["Gross Earnings","RM "+r.grossTotal.toFixed(2),C.green,true],
            ["Total Deductions","RM "+r.totalDeduct.toFixed(2),"#DC2626",false],
            ["Net Take-Home","RM "+r.netTotal.toFixed(2),C.green,true],
            ["Daily Rate","RM "+dailyRate.toFixed(4)+(schedSrc?" *":""),C.ts,false],
            ["Hourly Rate","RM "+hourlyRate.toFixed(4)+(schedSrc?" *":""),C.ts,false],
          ].map(function(item,i) {
            return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+C.border+"44"}}>
                <span style={S.ts12}>{item[0]}</span>
                <span style={{color:item[2],fontWeight:item[3]?700:400,fontSize:item[3]?14:12}}>{item[1]}</span>
              </div>            );
          })}
          {schedSrc && <div style={{color:C.ts,fontSize:9,marginTop:4}}>* Rates based on actual scheduled working days and hours</div>}
        </div>
      </div>
    </div>  );
}

// -- Drilldown Earnings Tab
function DrillEarnings(p) {
  var r = p.r; var wd = p.wd;
  var realWd  = r.schedWd        || wd;
  var realHph = r.schedHrsPerDay || 8;
  var dailyRate  = (r.dailyRate  || (r.basic / realWd)).toFixed(4);
  var hourlyRate = (r.hourlyRate || (r.basic / (realWd * realHph))).toFixed(4);
  var items = [
    {label:"Basic Salary", value:"RM "+r.basic.toFixed(2), note:"Employee Profile > Compensation", c:C.tp},
  ];
  if (r.travel > 0) items.push({label:"Travel Allowance", value:"RM "+r.travel.toFixed(2), note:"Fixed monthly allowance", c:C.ts});
  if (r.support > 0) items.push({label:"Support Allowance", value:"RM "+r.support.toFixed(2), note:"Fixed monthly allowance", c:C.ts});
  if (r.other > 0) items.push({label:r.otherLabel||"Other Allowance", value:"RM "+r.other.toFixed(2), note:"Variable allowance", c:C.ts});
  if (r.incentive > 0) items.push({label:"Commission / Incentive", value:"RM "+r.incentive.toFixed(2), note:"See Commission tab", c:C.amber});
  if (r.otAmt > 0) items.push({label:"Overtime ("+r.otHours+"hrs x 1.5)", value:"RM "+r.otAmt.toFixed(2), note:"RM "+hourlyRate+" x "+r.otHours+" hrs x 1.5", c:C.amber});
  if (r.backdate > 0) items.push({label:"Backdated Pay", value:"RM "+r.backdate.toFixed(2), note:"Salary adjustment", c:C.accent});
  return (
    <div>
      <div style={{background:C.greenL,borderRadius:12,padding:"16px 18px",marginBottom:14}}>
        <div style={{color:C.green,fontWeight:700,fontSize:11,letterSpacing:"0.8px",marginBottom:10}}>EARNINGS BREAKDOWN</div>
        {items.map(function(item,i) {
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.border+"44"}}>
              <div>
                <div style={{color:C.tp,fontSize:12,fontWeight:600}}>{item.label}</div>
                <div style={{color:C.ts,fontSize:10,marginTop:1}}>{item.note}</div>
              </div>
              <span style={{color:item.c,fontWeight:700,fontSize:13}}>{item.value}</span>
            </div>          );
        })}
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",marginTop:6,borderTop:"2px solid "+C.green+"44"}}>
          <span style={S.tp13b}>GROSS TOTAL</span>
          <span style={{color:C.green,fontWeight:900,fontSize:15}}>RM {r.grossTotal.toFixed(2)}</span>
        </div>
      </div>
      {r.otAmt > 0 && (
        <div style={{background:C.amberL,borderRadius:10,padding:"14px 16px"}}>
          <div style={{color:C.amber,fontWeight:700,fontSize:11,marginBottom:8}}>OT CALCULATION</div>
          {[
            ["Basic / "+wd+" days","= RM "+dailyRate+"/day"],
            ["Daily / 8 hours","= RM "+hourlyRate+"/hr"],
            ["OT Hours",r.otHours+" hrs"],
            ["Formula","RM "+hourlyRate+" x "+r.otHours+" x 1.5"],
            ["OT Amount","RM "+r.otAmt.toFixed(2)],
          ].map(function(row,i) {
            return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+C.border+"33"}}>
                <span style={S.ts11}>{row[0]}</span>
                <span style={{color:C.amber,fontWeight:600,fontSize:11}}>{row[1]}</span>
              </div>            );
          })}
        </div>
      )}
    </div>  );
}

// -- Drilldown Deductions Tab
function DrillDeductions(p) {
  var r = p.r; var wd = p.wd;
  var realWd  = r.schedWd        || wd;
  var realHph = r.schedHrsPerDay || 8;
  var dailyRate  = (r.dailyRate  || (r.basic / realWd)).toFixed(4);
  var hourlyRate = (r.hourlyRate || (r.basic / (realWd * realHph))).toFixed(4);
  var items = [];
  if (r.unpaidAmt > 0) items.push({label:"Unpaid/Absent", value:"RM "+r.unpaidAmt.toFixed(2), note:r.unpaidDays+" day(s) x RM "+dailyRate, c:C.red});
  if (r.lateAmt > 0) items.push({label:"Late Deduction", value:"RM "+r.lateAmt.toFixed(2), note:r.lateHours+" hr(s) x RM "+hourlyRate, c:C.red});
  if (r.epfEe > 0) items.push({label:"EPF Employee", value:"RM "+r.epfEe.toFixed(2), note:"Mandatory statutory", c:C.green});
  if (r.socsoEe > 0) items.push({label:"SOCSO Employee", value:"RM "+r.socsoEe.toFixed(2), note:"Mandatory statutory", c:C.accent});
  if (r.eisEe > 0) items.push({label:"EIS Employee", value:"RM "+r.eisEe.toFixed(2), note:"Mandatory statutory", c:C.accent});
  if (r.pcb > 0) items.push({label:"PCB (Tax)", value:"RM "+r.pcb.toFixed(2), note:"LHDN monthly deduction", c:C.purple});
  if (r.cp38 > 0) items.push({label:"CP38 (IRB Instalment)", value:"RM "+r.cp38.toFixed(2), note:"LHDN Order — remit to IRB", c:C.red});
  if (r.loan > 0) items.push({label:"Salary Advance", value:"RM "+r.loan.toFixed(2), note:"Recovery", c:C.amber});
  return (
    <div>
      <div style={{background:C.redL,borderRadius:12,padding:"16px 18px",marginBottom:14}}>
        <div style={{color:C.red,fontWeight:700,fontSize:11,letterSpacing:"0.8px",marginBottom:10}}>DEDUCTIONS BREAKDOWN</div>
        {items.map(function(item,i) {
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.border+"44"}}>
              <div>
                <div style={{color:C.tp,fontSize:12,fontWeight:600}}>{item.label}</div>
                <div style={{color:C.ts,fontSize:10,marginTop:1}}>{item.note}</div>
              </div>
              <span style={{color:item.c,fontWeight:700,fontSize:13}}>{item.value}</span>
            </div>          );
        })}
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",marginTop:6,borderTop:"2px solid "+C.red+"44"}}>
          <span style={S.tp13b}>TOTAL DEDUCTIONS</span>
          <span style={{color:C.red,fontWeight:900,fontSize:15}}>RM {r.totalDeduct.toFixed(2)}</span>
        </div>
      </div>
      {(r.unpaidAmt > 0 || r.lateAmt > 0) && (
        <div style={{background:C.surface,borderRadius:10,padding:"14px 16px"}}>
          <div style={{color:C.tp,fontWeight:700,fontSize:11,marginBottom:10}}>ABSENCE / LATE CALCULATION</div>
          {r.unpaidAmt > 0 && (
            <div style={S.mb12}>
              <div style={{color:C.red,fontWeight:600,fontSize:12,marginBottom:4}}>Absent Days</div>
              {[
                ["Basic","RM "+r.basic.toFixed(2)],
                ["Working Days",wd+" days"],
                ["Daily Rate","RM "+r.basic.toFixed(2)+" / "+wd+" = RM "+dailyRate],
                ["Absent","x "+r.unpaidDays+" day(s)"],
                ["Deduction","RM "+r.unpaidAmt.toFixed(2)],
              ].map(function(row,i) {
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid "+C.border+"22"}}>
                    <span style={S.ts11}>{row[0]}</span>
                    <span style={{color:C.red,fontWeight:600,fontSize:11}}>{row[1]}</span>
                  </div>                );
              })}
            </div>
          )}
          {r.lateAmt > 0 && (
            <div>
              <div style={{color:C.amber,fontWeight:600,fontSize:12,marginBottom:4}}>Late Arrival</div>
              {[
                ["Hourly Rate","RM "+hourlyRate],
                ["Late","x "+r.lateHours+" hr(s)"],
                ["Deduction","RM "+r.lateAmt.toFixed(2)],
              ].map(function(row,i) {
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid "+C.border+"22"}}>
                    <span style={S.ts11}>{row[0]}</span>
                    <span style={{color:C.amber,fontWeight:600,fontSize:11}}>{row[1]}</span>
                  </div>                );
              })}
            </div>
          )}
        </div>
      )}
    </div>  );
}

// -- Drilldown Statutory Tab
function DrillStatutory(p) {
  var r = p.r; var emp = p.emp;
  return (
    <div style={S.g2s}>
      <div style={{background:C.greenL,borderRadius:10,padding:"14px 16px"}}>
        <div style={{color:C.green,fontWeight:700,fontSize:12,marginBottom:8}}>EPF (KWSP)</div>
        {[
          ["Basic (EPF Base)","RM "+r.basic.toFixed(2)],
          ["EE Rate",r.age>=60?"0% (Age 60+)":r.age>=55?"5.5%":"11%"],
          ["EE Amount","RM "+r.epfEe.toFixed(2)],
          ["ER Rate",r.age>=60?"4%":r.age>=55?"6.5%":r.basic<=5000?"13%":"12%"],
          ["ER Amount","RM "+r.epfEr.toFixed(2)],
          ["Total","RM "+(r.epfEe+r.epfEr).toFixed(2)],
        ].map(function(row,i) {
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+C.border+"33"}}>
              <span style={S.ts11}>{row[0]}</span>
              <span style={{color:C.green,fontWeight:600,fontSize:11}}>{row[1]}</span>
            </div>          );
        })}
      </div>
      <div style={{background:C.accentL,borderRadius:10,padding:"14px 16px"}}>
        <div style={{color:C.accent,fontWeight:700,fontSize:12,marginBottom:8}}>SOCSO + EIS</div>
        {[
          ["SOCSO Cat",r.age>=60?"Cat 2":"Cat 1"],
          ["SOCSO EE","RM "+r.socsoEe.toFixed(2)],
          ["SOCSO ER","RM "+r.socsoEr.toFixed(2)],
          ["EIS EE",r.age>=60?"Exempt":"RM "+r.eisEe.toFixed(2)],
          ["EIS ER",r.age>=60?"Exempt":"RM "+r.eisEr.toFixed(2)],
        ].map(function(row,i) {
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+C.border+"33"}}>
              <span style={S.ts11}>{row[0]}</span>
              <span style={{color:C.accent,fontWeight:600,fontSize:11}}>{row[1]}</span>
            </div>          );
        })}
      </div>
      <div style={{background:C.purpleL,borderRadius:10,padding:"14px 16px"}}>
        <div style={{color:C.purple,fontWeight:700,fontSize:12,marginBottom:8}}>PCB / MTD — LHDN MYtax (YA 2024)</div>
        {(function(){
          var pcbOpts = {
            spouseRelief:emp.spouseRelief||false, spouseDisabled:emp.spouseDisabled||false,
            selfDisabled:emp.selfDisabled||false, selfStudying:emp.selfStudying||false,
            educationFees:emp.educationFees||0, childrenDetails:emp.childrenDetails||[],
            pcbChildren:parseInt(emp.pcbChildren)||0, epfEeAmt:r.epfEe,
            lifeInsurance:emp.lifeInsurance||0, medicalInsurance:emp.medicalInsurance||0,
            medicalSelf:emp.medicalSelf||0, medicalParents:emp.medicalParents||0,
            disabilityEquipment:emp.disabilityEquipment||0, breastfeeding:emp.breastfeeding||0,
            childcareRelief:emp.childcareRelief||0, sportEquipment:emp.sportEquipment||0,
            domesticTourism:emp.domesticTourism||0, electricVehicleCharge:emp.electricVehicleCharge||0,
            privateRetirement:emp.privateRetirement||0, sspRelief:emp.sspRelief||0,
          };
          var pd = getPcb(r.basic, pcbOpts);
          var kids = emp.childrenDetails||[];
          var kidRelief = kids.length ? kids.reduce(function(s,c){
            var a=parseInt(c.age)||0; var d=c.disabled; var l=c.studyLevel||"none";
            if(d) return s+(l==="university"?16000:8000);
            if(a<=18) return s+2000;
            if(a<=23&&(l==="university"||l==="secondary")) return s+8000;
            return s;
          },0) : ((parseInt(emp.pcbChildren)||0)*2000);
          var rows = [
            ["Annual Income (Basic x12)","RM "+(r.basic*12).toFixed(2)],
            ["—","—"],
            ["Self Relief (s.46(1)(a))","RM 9,000"],
            emp.selfDisabled ? ["Self Disabled (OKU)","RM 6,000"] : null,
            emp.selfStudying ? ["Self Further Education","RM "+(Math.min(emp.educationFees||7000,7000)).toLocaleString()] : null,
            ["EPF Relief (max RM 4,000)","RM "+Math.min(r.epfEe*12,4000).toFixed(0)],
            (emp.lifeInsurance>0) ? ["Life Insurance","RM "+(emp.lifeInsurance).toLocaleString()] : null,
            (emp.medicalInsurance>0) ? ["Medical Insurance","RM "+(emp.medicalInsurance).toLocaleString()] : null,
            emp.spouseRelief ? ["Spouse Relief","RM 4,000"] : null,
            emp.spouseRelief&&emp.spouseDisabled ? ["Disabled Spouse","RM 3,500"] : null,
            kidRelief>0 ? ["Child Relief ("+kids.length+" child"+(kids.length!==1?"ren":"")+" / "+((parseInt(emp.pcbChildren)||0))+" simple)","RM "+kidRelief.toLocaleString()] : null,
            (emp.medicalSelf>0) ? ["Medical Self/Spouse/Child (max RM 10,000)","RM "+Math.min(emp.medicalSelf,10000).toLocaleString()] : null,
            (emp.medicalParents>0) ? ["Medical Parents (max RM 8,000)","RM "+Math.min(emp.medicalParents,8000).toLocaleString()] : null,
            (emp.privateRetirement>0) ? ["PRS (max RM 3,000)","RM "+Math.min(emp.privateRetirement,3000).toLocaleString()] : null,
            (emp.sspRelief>0) ? ["SSP (max RM 3,000)","RM "+Math.min(emp.sspRelief,3000).toLocaleString()] : null,
            (emp.childcareRelief>0) ? ["Childcare Fees (max RM 3,000)","RM "+Math.min(emp.childcareRelief,3000).toLocaleString()] : null,
            (emp.sportEquipment>0) ? ["Sport Equipment (max RM 1,000)","RM "+Math.min(emp.sportEquipment,1000).toLocaleString()] : null,
            (emp.domesticTourism>0) ? ["Domestic Tourism (max RM 1,000)","RM "+Math.min(emp.domesticTourism,1000).toLocaleString()] : null,
            (emp.electricVehicleCharge>0) ? ["EV Charging (max RM 2,500)","RM "+Math.min(emp.electricVehicleCharge,2500).toLocaleString()] : null,
            ["—","—"],
            ["Total Relief","RM "+(pd.totalRelief||0).toLocaleString()],
            ["Chargeable Income","RM "+(pd.chargeable||0).toLocaleString()],
            ["—","—"],
            ["Monthly PCB/MTD","RM "+r.pcb.toFixed(2)],
            ["Annual Tax Est.","RM "+(r.pcb*12).toFixed(2)],
          ].filter(Boolean);
          return rows.map(function(row,i){
            var isDivider = row[0]==="—";
            if(isDivider) return <div key={i} style={{borderTop:"1px dashed "+C.border+"55",margin:"4px 0"}} />;
            var isTotal = row[0]==="Monthly PCB/MTD"||row[0]==="Total Relief"||row[0]==="Chargeable Income"||row[0]==="Annual Tax Est.";
            return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid "+C.border+"22"}}>
                <span style={{color:isTotal?C.tp:C.ts,fontSize:11,fontWeight:isTotal?700:400}}>{row[0]}</span>
                <span style={{color:isTotal?C.purple:C.ts,fontWeight:isTotal?700:500,fontSize:11}}>{row[1]}</span>
              </div>            );
          });
        })()}
      </div>
      <div style={{background:C.amberL,borderRadius:10,padding:"14px 16px"}}>
        <div style={{color:C.amber,fontWeight:700,fontSize:12,marginBottom:8}}>HRDF</div>
        {[
          ["Basic","RM "+r.basic.toFixed(2)],
          ["Rate","1%"],
          ["Enabled",emp.hrdfEnabled!==false?"Yes":"No"],
          ["Amount","RM "+r.hrdf.toFixed(2)],
          ["Payer","Employer only"],
        ].map(function(row,i) {
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+C.border+"33"}}>
              <span style={S.ts11}>{row[0]}</span>
              <span style={{color:C.amber,fontWeight:600,fontSize:11}}>{row[1]}</span>
            </div>          );
        })}
      </div>
    </div>  );
}

// -- Drilldown Commission Tab
function DrillCommission(p) {
  var r = p.r; var emp = p.emp; var period = p.period;
  if (r.incentive <= 0) {
    return (
      <div style={{textAlign:"center",padding:"40px 20px"}}>
        <div style={{fontSize:40,marginBottom:12}}>💰</div>
        <div style={{color:C.tp,fontWeight:600,fontSize:14,marginBottom:6}}>No commission this month</div>
        <div style={S.ts12}>{period}</div>
      </div>    );
  }
  return (
    <div>
      <div style={{background:C.amberL,borderRadius:12,padding:"16px 18px",marginBottom:14}}>
        <div style={{color:C.amber,fontWeight:700,fontSize:11,marginBottom:10}}>COMMISSION BREAKDOWN</div>
        {[
          ["Label",emp.otherAllowLabel||"Sales Incentive"],
          ["Amount","RM "+r.incentive.toFixed(2)],
          ["EPF Applicable","No (non-wage allowance)"],
          ["SOCSO Applicable","No (non-wages item)"],
          ["PCB Impact","Included in gross for tax"],
          ["In Gross","Yes - RM "+r.incentive.toFixed(2)],
        ].map(function(row,i) {
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+C.border+"44"}}>
              <span style={S.ts12}>{row[0]}</span>
              <span style={{color:C.amber,fontWeight:700,fontSize:12}}>{row[1]}</span>
            </div>          );
        })}
      </div>
      <div style={{background:C.surface,borderRadius:10,padding:"14px 16px"}}>
        <div style={{color:C.tp,fontWeight:700,fontSize:12,marginBottom:8}}>EXAMPLE COMMISSION TIERS</div>
        {[
          ["Below RM 5,000 sales","No commission"],
          ["RM 5,001 - 10,000","5% of sales"],
          ["RM 10,001 - 20,000","8% of sales"],
          ["Above RM 20,000","10% + bonus"],
        ].map(function(row,i) {
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+C.border+"33"}}>
              <span style={S.ts12}>{row[0]}</span>
              <span style={{color:C.accent,fontWeight:600,fontSize:12}}>{row[1]}</span>
            </div>          );
        })}
      </div>
    </div>  );
}

// -- Main Drilldown Modal
function PayrollDrillModal(p) {
  var r = p.drillRow;
  var setDrillRow = p.setDrillRow;
  var drillTab = p.drillTab;
  var setDrillTab = p.setDrillTab;
  var batch = p.batch;
  var employees = p.employees;
  if (!r) return null;
  var emp = employees.find(function(e) { return e.id === r.empId; }) || {};
  var wd = batch ? batch.wd : 26;
  var period = batch ? batch.period : "";
  var TABS = [["overview","Overview"],["earnings","Earnings"],["deductions","Deductions"],["statutory","Statutory"],["commission","Commission"]];
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,.55)",zIndex:3000,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"40px 20px"}}>
      <div style={{background:C.card,borderRadius:18,width:"100%",maxWidth:720,boxShadow:"0 24px 80px rgba(14,165,201,.2)",overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <Avatar name={r.name} size={46} />
            <div>
              <div style={{color:"#fff",fontWeight:800,fontSize:17}}>{r.name}</div>
              <div style={{color:"rgba(255,255,255,.75)",fontSize:12,marginTop:2}}>{r.dept} - {r.empId} - {period}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{background:"rgba(255,255,255,.2)",borderRadius:8,padding:"6px 12px",color:"#fff",fontSize:13,fontWeight:700}}>
              Net: RM {r.netTotal.toFixed(2)}
            </div>
            <button onClick={function(){setDrillRow(null);}} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:16,cursor:"pointer",padding:"4px 10px",fontFamily:"inherit"}}>X</button>
          </div>
        </div>
        <div style={{display:"flex",background:C.surface,borderBottom:"2px solid "+C.border}}>
          {TABS.map(function(t) {
            return (
              <button key={t[0]} onClick={function(){setDrillTab(t[0]);}} style={{padding:"10px 14px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:"transparent",border:"none",color:drillTab===t[0]?C.accent:C.ts,borderBottom:"2px solid "+(drillTab===t[0]?C.accent:"transparent"),marginBottom:"-2px",whiteSpace:"nowrap"}}>
                {t[1]}
              </button>            );
          })}
        </div>
        <div style={{padding:"20px 24px",maxHeight:"60vh",overflowY:"auto"}}>
          {drillTab === "overview"    && <DrillOverview    r={r} emp={emp} wd={wd} />}
          {drillTab === "earnings"    && <DrillEarnings    r={r} wd={wd} />}
          {drillTab === "deductions"  && <DrillDeductions  r={r} wd={wd} />}
          {drillTab === "statutory"   && <DrillStatutory   r={r} emp={emp} />}
          {drillTab === "commission"  && <DrillCommission  r={r} emp={emp} period={period} />}
        </div>
        <div style={{padding:"12px 24px",borderTop:"1px solid "+C.border,display:"flex",justifyContent:"flex-end"}}>
          <Btn c={C.ts} onClick={function(){setDrillRow(null);}}>Close</Btn>
        </div>
      </div>
    </div>  );
}

// -- Column picker
function PayrollColPicker(p) {
  if (!p.colMenu) return null;
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2500}} onClick={function(){p.setColMenu(null);}}>
      <div style={{position:"absolute",top:p.colMenu.y,left:p.colMenu.x,background:C.card,border:"1.5px solid "+C.border,borderRadius:12,padding:12,minWidth:220,boxShadow:"0 8px 32px rgba(0,0,0,.15)",zIndex:2501}} onClick={function(e){e.stopPropagation();}}>
        <div style={{color:C.tp,fontWeight:700,fontSize:12,marginBottom:10,paddingBottom:8,borderBottom:"1px solid "+C.border}}>Show / Hide Columns</div>
        {ALL_COLS.map(function(col) {
          var active = p.visCols.indexOf(col.k) > -1;
          return (
            <div key={col.k} onClick={function(){p.toggleCol(col.k);}} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:col.fixed?"default":"pointer",background:active?C.accentL+"66":"transparent",marginBottom:2}}>
              <div style={{width:14,height:14,borderRadius:3,background:active?C.accent:C.surface,border:"1.5px solid "+(active?C.accent:C.border),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {active && <span style={{color:"#fff",fontSize:9,fontWeight:900}}>v</span>}
              </div>
              <span style={{color:col.fixed?C.ts:C.tp,fontSize:12}}>{col.label}</span>
              {col.fixed && <span style={{color:C.tm,fontSize:10,marginLeft:"auto"}}>fixed</span>}
            </div>          );
        })}
        <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid "+C.border,display:"flex",gap:6}}>
          <button onClick={function(){p.setVisCols(ALL_COLS.map(function(c){return c.k;}));}} style={{flex:1,background:C.accentL,color:C.accent,border:"none",borderRadius:6,padding:"5px 0",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>All</button>
          <button onClick={function(){p.setVisCols(DEFAULT_VIS);}} style={{flex:1,background:C.surface,color:C.ts,border:"none",borderRadius:6,padding:"5px 0",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Reset</button>
        </div>
      </div>
    </div>  );
}

// -- Payroll Export Modal (Preview + PDF + Excel)
function PayrollExportMenu(p) {
  if (!p.exportMenu) return null;
  var batch   = p.batch;
  var rows    = p.sortedRows;
  var visCols = p.visibleCols;
  var co      = p.co || {};
  var [view, setView] = useState("menu"); // "menu" | "preview"
  var [toast, setToast] = useState(null);

  var showToast = function(msg, color) {
    setToast({msg:msg, color:color||C.green});
    setTimeout(function(){ setToast(null); }, 3000);
  };

  var rm = function(v) { return parseFloat(v||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); };
  var allCols = ALL_COLS; // all columns for full export

  // ── Build rich print-ready HTML ────────────────────────────────────────
  var buildPrintHTML = function() {
    var period = batch ? batch.period : "Export";
    var today  = new Date().toLocaleDateString("en-MY",{day:"2-digit",month:"short",year:"numeric"});
    var totGross = parseFloat(rows.reduce(function(s,r){ return s+(parseFloat(r.grossTotal)||0); },0).toFixed(2));
    var totNet   = parseFloat(rows.reduce(function(s,r){ return s+(parseFloat(r.netTotal)||0); },0).toFixed(2));
    var totEpf   = parseFloat(rows.reduce(function(s,r){ return s+(parseFloat(r.epfEe)||0); },0).toFixed(2));
    var totPcb   = parseFloat(rows.reduce(function(s,r){ return s+(parseFloat(r.pcb)||0); },0).toFixed(2));
    var totSocso = parseFloat(rows.reduce(function(s,r){ return s+(parseFloat(r.socsoEe)||0); },0).toFixed(2));

    var thCols = visCols.map(function(c){
      return '<th style="background:#0D1226;color:#fff;padding:7px 10px;text-align:'+(c.align||"left")+';white-space:nowrap;font-size:9px">'+c.label+'</th>';
    }).join("");

    var bodyRows = rows.map(function(r, i){
      var bg = i%2===0 ? "#fff" : "#f8faff";
      var tds = visCols.map(function(c){
        var v = r[c.k];
        var isNum = NUM_KEYS.indexOf(c.k) > -1;
        var display = isNum ? rm(v) : (v||"-");
        var color = c.k==="netTotal"?"#059669":c.k==="pcb"?"#7C3AED":c.k==="grossTotal"?"#047857":"#0D1226";
        var fw = (c.k==="netTotal"||c.k==="grossTotal") ? "700" : "400";
        return '<td style="padding:5px 10px;text-align:'+(c.align||"left")+';color:'+color+';font-weight:'+fw+';font-size:9px;border-bottom:1px solid #e5e7eb">'+display+'</td>';
      }).join("");
      return '<tr style="background:'+bg+'">'+tds+'</tr>';
    }).join("");

    var tfCols = visCols.map(function(c){
      var isNum = NUM_KEYS.indexOf(c.k) > -1;
      var v = isNum ? rm(rows.reduce(function(s,r){ return s+(parseFloat(r[c.k])||0); },0)) : "";
      return '<td style="padding:7px 10px;text-align:'+(c.align||"left")+';font-weight:700;font-size:9px;background:#EEF1FE;border-top:2px solid #0D1226">'+v+'</td>';
    }).join("");

    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payroll '+period+'</title><style>'+
      '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#000;margin:0;padding:16px;background:#fff}'+
      'table{width:100%;border-collapse:collapse}'+
      '.btn{display:inline-block;background:#1E40AF;color:#fff;border:none;padding:7px 20px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;margin-bottom:14px}'+
      '@media print{.btn,.no-print{display:none!important}}'+
      '</style></head><body>'+
      '<button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button>'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'+
        '<div><div style="font-size:15px;font-weight:900;color:#0D1226">'+(co.name||"HRCloud Malaysia")+'</div>'+
        '<div style="font-size:10px;color:#4A5374">Payroll Report — '+period+'</div></div>'+
        '<div style="text-align:right;font-size:9px;color:#666">Generated: '+today+'<br/>'+rows.length+' employees</div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0;padding:10px;background:#f0f4ff;border-radius:6px">'+
        '<div style="text-align:center"><div style="font-size:8px;color:#666;font-weight:700">TOTAL GROSS</div><div style="font-size:13px;font-weight:900;color:#059669">RM '+rm(totGross)+'</div></div>'+
        '<div style="text-align:center"><div style="font-size:8px;color:#666;font-weight:700">TOTAL NET</div><div style="font-size:13px;font-weight:900;color:#1E40AF">RM '+rm(totNet)+'</div></div>'+
        '<div style="text-align:center"><div style="font-size:8px;color:#666;font-weight:700">EPF (EE)</div><div style="font-size:13px;font-weight:900;color:#0EA5C9">RM '+rm(totEpf)+'</div></div>'+
        '<div style="text-align:center"><div style="font-size:8px;color:#666;font-weight:700">SOCSO (EE)</div><div style="font-size:13px;font-weight:900;color:#4F6EF7">RM '+rm(totSocso)+'</div></div>'+
        '<div style="text-align:center"><div style="font-size:8px;color:#666;font-weight:700">PCB (MTD)</div><div style="font-size:13px;font-weight:900;color:#7C3AED">RM '+rm(totPcb)+'</div></div>'+
      '</div>'+
      '<table><thead><tr>'+thCols+'</tr></thead><tbody>'+bodyRows+'</tbody><tfoot><tr>'+tfCols+'</tr></tfoot></table>'+
      '</body></html>';
  };

  // ── Build Excel file styled exactly like the preview ───────────────────
  var buildAndDownloadExcel = function() {
    var period  = batch ? batch.period : "Export";
    var coName  = co.name || "HRCloud Malaysia";
    var today   = new Date();

    var titleDate = (function(){
      if (!batch || !batch.month) return period;
      var parts = batch.month.split("-");
      var yr = parseInt(parts[0]); var mo = parseInt(parts[1])-1;
      var lastDay = new Date(yr, mo+1, 0);
      var dd = lastDay.getDate();
      var sfx = dd===1?"st":dd===2?"nd":dd===3?"rd":"th";
      var MO=["January","February","March","April","May","June","July","August","September","October","November","December"];
      return dd+sfx+" "+MO[mo]+" "+yr;
    })();
    var reportTitle = "Payroll for the month of "+titleDate;
    var genDate = "Generated: "+today.toLocaleDateString("en-MY",{day:"2-digit",month:"short",year:"numeric"})+"   |   "+rows.length+" employees";

    var nv = function(v){ return parseFloat(parseFloat(v||0).toFixed(2)); };
    var sum = function(k){ return nv(rows.reduce(function(s,r){return s+nv(r[k]);},0)); };
    var fmt = function(v){ return nv(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); };

    var totGross=sum("grossTotal"), totNet=sum("netTotal"),   totEpfEe=sum("epfEe"),   totEpfEr=sum("epfEr");
    var totSocsoEe=sum("socsoEe"), totSocsoEr=sum("socsoEr"),totEisEe=sum("eisEe"),   totEisEr=sum("eisEr");
    var totPcb=sum("pcb"),         totHrdf=sum("hrdf"),       totDeduct=sum("totalDeduct");
    var totErCost=nv(totGross+totEpfEr+totSocsoEr+totEisEr+totHrdf);

    // Dept summary
    var deptMap = {};
    rows.forEach(function(r){
      if (!deptMap[r.dept]) deptMap[r.dept]={dept:r.dept,count:0,gross:0,net:0,epfEe:0,pcb:0,deduct:0};
      deptMap[r.dept].count++; deptMap[r.dept].gross+=nv(r.grossTotal); deptMap[r.dept].net+=nv(r.netTotal);
      deptMap[r.dept].epfEe+=nv(r.epfEe); deptMap[r.dept].pcb+=nv(r.pcb); deptMap[r.dept].deduct+=nv(r.totalDeduct);
    });
    var depts = Object.keys(deptMap).map(function(k){return deptMap[k];});

    // ── HTML table builder — matches preview exactly ──────────────────────
    var esc = function(v){ return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };

    var buildTable = function(headers, hAligns, dataRows, totRow) {
      var thead = "<tr>"+headers.map(function(h,i){
        return '<th style="background:#0D1226;color:#fff;padding:7px 10px;text-align:'+(hAligns[i]||"left")+';white-space:nowrap;font-size:9pt;font-family:Arial;border:1px solid #1E3A8A;">'+esc(h)+'</th>';
      }).join("")+"</tr>";

      var tbody = dataRows.map(function(dr, ri){
        var bg = ri%2===0 ? "#FFFFFF" : "#F8FAFF";
        return "<tr>"+dr.map(function(cell,ci){
          var val = typeof cell.v==="number" ? fmt(cell.v) : esc(cell.v||"");
          var align = hAligns[ci]||"left";
          var color = cell.color||"#0D1226";
          var fw = cell.bold?"bold":"normal";
          return '<td style="background:'+bg+';color:'+color+';font-weight:'+fw+';text-align:'+align+';padding:5px 10px;font-size:9pt;font-family:Arial;border:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;">'+val+'</td>';
        }).join("")+"</tr>";
      }).join("");

      var tfoot = totRow ? "<tr>"+totRow.map(function(cell,ci){
        var val = typeof cell.v==="number" ? fmt(cell.v) : esc(cell.v||"");
        var align = hAligns[ci]||"left";
        var color = cell.color||"#0D1226";
        return '<td style="background:#EEF1FE;color:'+color+';font-weight:bold;text-align:'+align+';padding:7px 10px;font-size:9pt;font-family:Arial;border:1px solid #C7D2FE;border-top:2px solid #0D1226;">'+val+'</td>';
      }).join("")+"</tr>" : "";

      return '<table style="border-collapse:collapse;width:100%;margin-bottom:24px"><thead>'+thead+'</thead><tbody>'+tbody+'</tbody>'+(totRow?"<tfoot>"+tfoot+"</tfoot>":"")+'</table>';
    };

    // ── Section title ─────────────────────────────────────────────────────
    var sectionTitle = function(t){
      return '<div style="background:#1E3A8A;color:#fff;font-weight:bold;font-size:11pt;font-family:Arial;padding:8px 12px;margin-top:24px;margin-bottom:0;border-radius:4px 4px 0 0;">'+esc(t)+'</div>';
    };

    // ── Sheet 1: Payroll Detail ───────────────────────────────────────────
    var dc = visCols;
    var s1headers = dc.map(function(c){return c.label;});
    var s1aligns  = dc.map(function(c){return NUM_KEYS.indexOf(c.k)>-1?"right":"left";});
    var s1rows = rows.map(function(r){
      return dc.map(function(col){
        var v=r[col.k]; var isN=NUM_KEYS.indexOf(col.k)>-1;
        var val=isN?nv(v):(v||"");
        var color = col.k==="netTotal"||col.k==="grossTotal" ? "#059669" :
                    col.k==="totalDeduct"||col.k==="unpaidAmt"||col.k==="lateAmt" ? "#DC2626" :
                    col.k==="pcb" ? "#7C3AED" : "#0D1226";
        var bold = col.k==="netTotal"||col.k==="grossTotal"||col.k==="name";
        return {v:val, color:color, bold:bold};
      });
    });
    var s1tot = dc.map(function(col,ci){
      var isN=NUM_KEYS.indexOf(col.k)>-1;
      if(ci===0) return {v:"TOTAL ("+rows.length+" employees)", color:"#0D1226", bold:true};
      if(!isN)   return {v:"", color:"#0D1226"};
      var sv=sum(col.k);
      var color = col.k==="netTotal"||col.k==="grossTotal" ? "#059669" :
                  col.k==="totalDeduct"||col.k==="unpaidAmt"||col.k==="lateAmt" ? "#DC2626" :
                  col.k==="pcb" ? "#7C3AED" : "#0D1226";
      return {v:sv, color:color, bold:true};
    });

    // ── Sheet 2: By Department ────────────────────────────────────────────
    var s2headers=["Department","Headcount","Gross (RM)","Deductions (RM)","Net to Bank (RM)","EPF EE (RM)","PCB (RM)","% of Total"];
    var s2aligns =["left","right","right","right","right","right","right","right"];
    var s2rows = depts.map(function(d){
      var pct=totGross>0?nv(d.gross/totGross*100).toFixed(1):0;
      return [
        {v:d.dept,           color:"#0D1226",bold:true},
        {v:d.count,          color:"#1D4ED8",bold:true},
        {v:nv(d.gross),      color:"#059669",bold:true},
        {v:nv(d.deduct),     color:"#DC2626"},
        {v:nv(d.net),        color:"#059669",bold:true},
        {v:nv(d.epfEe),      color:"#0D1226"},
        {v:nv(d.pcb),        color:"#7C3AED"},
        {v:pct+"%",          color:"#1D4ED8"},
      ];
    });
    var s2tot=[
      {v:"TOTAL",color:"#0D1226",bold:true},
      {v:rows.length,color:"#1D4ED8",bold:true},
      {v:totGross,color:"#059669",bold:true},
      {v:totDeduct,color:"#DC2626",bold:true},
      {v:totNet,color:"#059669",bold:true},
      {v:totEpfEe,color:"#0D1226",bold:true},
      {v:totPcb,color:"#7C3AED",bold:true},
      {v:"100%",color:"#1D4ED8",bold:true},
    ];

    // ── Sheet 3: Employer Cost ────────────────────────────────────────────
    var s3headers=["Contribution","Amount (RM)"];
    var s3aligns=["left","right"];
    var s3rows=[
      [{v:"EPF Employer (13%)",color:"#0D1226"},{v:totEpfEr,  color:"#059669",bold:true}],
      [{v:"SOCSO Employer",    color:"#0D1226"},{v:totSocsoEr,color:"#0D1226"}],
      [{v:"EIS Employer",      color:"#0D1226"},{v:totEisEr,  color:"#0D1226"}],
      [{v:"HRDF (1%)",         color:"#0D1226"},{v:totHrdf,   color:"#D97706"}],
      [{v:"",color:"#0D1226"},{v:"",color:"#0D1226"}],
      [{v:"Total Gross Payroll (Employee)",color:"#0D1226",bold:true},{v:totGross,color:"#059669",bold:true}],
    ];
    var s3tot=[{v:"Total Employer Cost",color:"#0D1226",bold:true},{v:totErCost,color:"#DC2626",bold:true}];

    // ── Sheet 4: Summary ─────────────────────────────────────────────────
    var s4headers=["Metric","Amount (RM)"];
    var s4aligns=["left","right"];
    var s4rows=[
      [{v:"Gross Payroll",          color:"#0D1226",bold:true},{v:totGross,              color:"#059669",bold:true}],
      [{v:"Total Deductions",       color:"#0D1226",bold:true},{v:totDeduct,             color:"#DC2626",bold:true}],
      [{v:"Net to Bank",            color:"#0D1226",bold:true},{v:totNet,                color:"#1D4ED8",bold:true}],
      [{v:"EPF Employee",           color:"#0D1226",bold:true},{v:totEpfEe,              color:"#059669",bold:true}],
      [{v:"SOCSO + EIS (Employee)", color:"#0D1226",bold:true},{v:nv(totSocsoEe+totEisEe),color:"#0D1226",bold:true}],
      [{v:"PCB (MTD)",              color:"#0D1226",bold:true},{v:totPcb,                color:"#7C3AED",bold:true}],
      [{v:"",color:"#0D1226"},{v:"",color:"#0D1226"}],
      [{v:"EPF Employer",           color:"#0D1226",bold:true},{v:totEpfEr,              color:"#059669",bold:true}],
      [{v:"SOCSO + EIS (Employer)", color:"#0D1226",bold:true},{v:nv(totSocsoEr+totEisEr),color:"#0D1226",bold:true}],
      [{v:"HRDF",                   color:"#0D1226",bold:true},{v:totHrdf,               color:"#D97706",bold:true}],
      [{v:"",color:"#0D1226"},{v:"",color:"#0D1226"}],
      [{v:"Total Employer Cost",    color:"#0D1226",bold:true},{v:totErCost,             color:"#DC2626",bold:true}],
    ];

    // ── KPI band (matching preview) ───────────────────────────────────────
    var kpiHtml = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0 16px 0;padding:10px;background:#F0F4FF;border-radius:6px;border:1px solid #C7D2FE;">'+
      [["TOTAL GROSS","#059669",fmt(totGross)],["TOTAL NET","#1E40AF",fmt(totNet)],["EPF (EE)","#0EA5C9",fmt(totEpfEe)],["SOCSO (EE)","#4F6EF7",fmt(sum("socsoEe"))],["PCB (MTD)","#7C3AED",fmt(totPcb)]].map(function(k){
        return '<div style="text-align:center"><div style="font-size:7pt;color:#666;font-weight:bold;font-family:Arial">'+k[0]+'</div><div style="font-size:12pt;font-weight:900;color:'+k[1]+';font-family:Arial">RM '+k[2]+'</div></div>';
      }).join("")+
    '</div>';

    // ── Compose full HTML workbook ────────────────────────────────────────
    var css = '<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:9pt;margin:0;padding:16px;background:#fff}table{border-collapse:collapse;width:100%}@media print{body{padding:8px}}</style>';
    var header = '<div style="margin-bottom:6px">'+
      '<div style="font-size:16pt;font-weight:900;color:#0D1226;font-family:Arial">'+esc(coName)+'</div>'+
      '<div style="font-size:11pt;font-weight:bold;color:#1E40AF;font-family:Arial;margin-top:2px">'+esc(reportTitle)+'</div>'+
      '<div style="font-size:8pt;color:#4A5374;font-family:Arial;margin-top:2px">'+esc(genDate)+'</div>'+
    '</div>';

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+esc(reportTitle)+'</title>'+css+'</head><body>'+
      header+
      kpiHtml+
      sectionTitle("1. Payroll Detail — "+period)+
      buildTable(s1headers, s1aligns, s1rows, s1tot)+
      sectionTitle("2. By Department — "+period)+
      buildTable(s2headers, s2aligns, s2rows, s2tot)+
      sectionTitle("3. Employer Cost — "+period)+
      buildTable(s3headers, s3aligns, s3rows, s3tot)+
      sectionTitle("4. Payroll Summary — "+period)+
      buildTable(s4headers, s4aligns, s4rows, null)+
    '</body></html>';

    // Download as .xls — Excel opens HTML files natively with full formatting
    var blob = new Blob([html], {type:"application/vnd.ms-excel;charset=utf-8"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var fname = coName.replace(/[^a-zA-Z0-9]/g,"_")+"_Payroll_"+period.replace(/\s+/g,"_")+".xls";
    a.href=url; a.download=fname;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},2000);
    showToast("📊 "+fname+" downloaded — opens in Excel with full colors & formatting",C.green);
    p.setExportMenu(false);
  };
  var doDownload = function(content, filename, mime) {
    var blob = new Blob([content], {type:mime});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); },2000);
  };

  var handlePDF = function() {
    doDownload(buildPrintHTML(), "Payroll_"+(batch?batch.period:"Export")+".html", "text/html;charset=utf-8");
    showToast("📄 PDF-ready file downloaded — open & print/save as PDF", C.accent);
    p.setExportMenu(false);
  };

  var handleExcel = function() {
    buildAndDownloadExcel();
  };

  var handlePreview = function() { setView("preview"); };

  // ── Preview modal ───────────────────────────────────────────────────────
  if (view === "preview") {
    return (
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(10,18,40,.9)",zIndex:3000,display:"flex",flexDirection:"column"}}>
        <div style={{background:"#0F172A",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,.1)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{color:"#fff",fontWeight:700,fontSize:14}}>👁 Payroll Preview — {batch?batch.period:"Export"}</span>
            <span style={{color:"#64748B",fontSize:11}}>{rows.length} employees</span>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button onClick={handlePDF} style={{display:"flex",alignItems:"center",gap:6,background:"#DC2626",color:"#fff",border:"none",borderRadius:7,padding:"7px 16px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              <FileText size={13}/> Download PDF
            </button>
            <button onClick={handleExcel} style={{display:"flex",alignItems:"center",gap:6,background:"#059669",color:"#fff",border:"none",borderRadius:7,padding:"7px 16px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              <FileSpreadsheet size={13}/> Download Excel (.xls)
            </button>
            <button onClick={function(){setView("menu");p.setExportMenu(false);}} style={{background:"rgba(255,255,255,.12)",color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflow:"hidden",background:"#1E293B",padding:"16px",display:"flex",justifyContent:"center"}}>
          <div style={{width:"100%",maxWidth:1100,background:"#fff",borderRadius:8,boxShadow:"0 8px 40px rgba(0,0,0,.5)",overflow:"auto"}}>
            <iframe srcDoc={buildPrintHTML()} title="Payroll Preview" style={{width:"100%",minHeight:"calc(100vh - 100px)",border:"none"}} sandbox="allow-same-origin allow-scripts" />
          </div>
        </div>
      </div>
    );
  }

  // ── Export menu dropdown ────────────────────────────────────────────────
  return (
    <div>
      {toast && (
        <div style={{position:"fixed",top:16,right:20,zIndex:9999,background:toast.color,color:"#fff",padding:"10px 18px",borderRadius:9,fontWeight:700,fontSize:12,boxShadow:"0 4px 20px rgba(0,0,0,.25)",animation:"fadeIn .2s ease"}}>
          {toast.msg}
        </div>
      )}
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2500}} onClick={function(){p.setExportMenu(false);}}>
        <div style={{position:"absolute",top:80,right:24,background:C.card,border:"1.5px solid "+C.border,borderRadius:14,padding:12,minWidth:240,boxShadow:"0 8px 32px rgba(0,0,0,.18)",zIndex:2501}} onClick={function(e){e.stopPropagation();}}>
          <div style={{color:C.ts,fontSize:10,fontWeight:700,padding:"2px 4px",marginBottom:8,letterSpacing:0.8}}>EXPORT PAYROLL — {batch?batch.period:"No batch selected"}</div>
          {[
            {label:"Preview Report",    icon:<Eye size={15}/>,          c:C.accent,  action:handlePreview, desc:"Full-screen preview before download"},
            {label:"Download PDF",      icon:<FileText size={15}/>,      c:"#DC2626", action:handlePDF,     desc:"Print-ready — open & save as PDF"},
            {label:"Download Excel",    icon:<FileSpreadsheet size={15}/>,c:C.green,  action:handleExcel,   desc:"All columns as .csv for Excel"},
          ].map(function(item){
            return (
              <div key={item.label} onClick={item.action}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,cursor:"pointer",marginBottom:4,border:"1.5px solid "+C.border+"55",background:C.surface}}
                onMouseEnter={function(e){e.currentTarget.style.background=C.accentL;e.currentTarget.style.borderColor=C.accent+"55";}}
                onMouseLeave={function(e){e.currentTarget.style.background=C.surface;e.currentTarget.style.borderColor=C.border+"55";}}>
                <span style={{color:item.c,display:"flex",alignItems:"center"}}>{item.icon}</span>
                <div>
                  <div style={{color:C.tp,fontSize:12,fontWeight:700}}>{item.label}</div>
                  <div style={{color:C.ts,fontSize:10,marginTop:1}}>{item.desc}</div>
                </div>
              </div>
            );
          })}
          <div style={{marginTop:8,padding:"8px 10px",background:C.surface,borderRadius:8,border:"1px solid "+C.border+"44"}}>
            <div style={{color:C.ts,fontSize:9,fontWeight:700,marginBottom:4}}>SUMMARY</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
              {[
                ["Employees", rows.length],
                ["Gross", "RM "+parseFloat(rows.reduce(function(s,r){return s+(parseFloat(r.grossTotal)||0);},0).toFixed(0)).toLocaleString()],
                ["Net Pay","RM "+parseFloat(rows.reduce(function(s,r){return s+(parseFloat(r.netTotal)||0);},0).toFixed(0)).toLocaleString()],
                ["Cols",p.visibleCols.length+"/"+ALL_COLS.length+" visible"],
              ].map(function(item){return(
                <div key={item[0]} style={{textAlign:"center",padding:"4px 0"}}>
                  <div style={{color:C.ts,fontSize:8}}>{item[0]}</div>
                  <div style={{color:C.tp,fontSize:10,fontWeight:700}}>{item[1]}</div>
                </div>
              );})}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Main Payroll Module
function PayrollModule(props) {
  var employees = props.employees || [];
  var companies = props.companies || [];
  var activeCompany = props.activeCompany;
  var co = companies.find(function(c) { return c.id === activeCompany; }) || companies[0] || {};
  // Schedule data from root state (set in Scheduling module)
  var gSched      = props.sched        || {};
  var gWh         = props.wh           || {};
  var gUnified    = props.unifiedShift || {};
  var gSchedMode  = props.schedMode    || "off";
  var gPayrollCfg = props.payrollConfig || INIT_PAYROLL_CONFIG;

  // Batches hoisted to global state so PCB Verification Tool can read them
  var batches    = props.batches    || PAYROLL_BATCHES_INIT;
  var setBatches = props.setBatches || function(){};
  var _si  = useState(null);      var selId = _si[0]; var setSelId = _si[1];
  var _tab = useState("detail");  var tab = _tab[0]; var setTab = _tab[1];
  var _gm  = useState("2025-07"); var genMonth = _gm[0]; var setGenMonth = _gm[1];
  var _gw  = useState(26);        var genWd = _gw[0]; var setGenWd = _gw[1];
  var _sg  = useState(false);     var showGen = _sg[0]; var setShowGen = _sg[1];
  var _ov  = useState({});        var overrides = _ov[0]; var setOverrides = _ov[1];
  var _dlg = useState(null);      var dlg = _dlg[0]; var setDlg = _dlg[1];
  var [visCols, setVisCols] = useState(DEFAULT_VIS);
  var _sk  = useState("name");    var sortKey = _sk[0]; var setSortKey = _sk[1];
  var _sd  = useState("asc");     var sortDir = _sd[0]; var setSortDir = _sd[1];
  var _fq  = useState("");        var filterQ = _fq[0]; var setFilterQ = _fq[1];
  var _cm  = useState(null);      var colMenu = _cm[0]; var setColMenu = _cm[1];
  var _xm  = useState(false);     var exportMenu = _xm[0]; var setExportMenu = _xm[1];
  var _dr  = useState(null);      var drillRow = _dr[0]; var setDrillRow = _dr[1];
  var _dt  = useState("overview"); var drillTab = _dt[0]; var setDrillTab = _dt[1];

  var batch = batches.find(function(b) { return b.id === selId; });

  // Compute schedule stats for each employee based on the batch month
  var getSchedStats = function(empId) {
    if (!batch) return null;
    return computeScheduleStats(empId, batch.month, gSched, gWh, gUnified, gSchedMode);
  };

  var allRows = (batch ? employees : []).map(function(e) {
    var ss = getSchedStats(e.id);
    var ov_base = overrides[(selId+"-"+e.id)] || {};
    var ov_with_month = Object.assign({}, ov_base, {_batchMonth: batch ? batch.month : ""});
    return computeRow(e, batch ? batch.wd : 26, ov_with_month, ss, gPayrollCfg);
  });

  // Check if any employee has schedule data configured
  var hasSchedule = Object.keys(gWh).length > 0 || Object.keys(gSched).length > 0;

  var filteredRows = allRows.filter(function(r) {
    if (!filterQ) return true;
    var q = filterQ.toLowerCase();
    return r.name.toLowerCase().indexOf(q) > -1 || r.dept.toLowerCase().indexOf(q) > -1;
  });

  var sortedRows = filteredRows.slice().sort(function(a, b) {
    var va = a[sortKey]; var vb = b[sortKey];
    if (typeof va === "string") { va = va.toLowerCase(); vb = (vb||"").toLowerCase(); }
    else { va = parseFloat(va)||0; vb = parseFloat(vb)||0; }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  var T = function(k) { return sumF(allRows, k); };

  var toggleCol = function(k) {
    var col = ALL_COLS.find(function(c) { return c.k === k; });
    if (col && col.fixed) return;
    setVisCols(function(prev) {
      if (prev.indexOf(k) > -1) return prev.filter(function(x) { return x !== k; });
      return prev.concat([k]);
    });
  };

  var visibleCols = ALL_COLS.filter(function(c) { return visCols.indexOf(c.k) > -1; });

  var handleSort = function(k) {
    if (sortKey === k) { setSortDir(function(d) { return d === "asc" ? "desc" : "asc"; }); }
    else { setSortKey(k); setSortDir("asc"); }
  };

  var exportCSV = function() {
    var hdrs = visibleCols.map(function(c) { return c.label; });
    var bodyLines = [hdrs.join(",")];
    sortedRows.forEach(function(r) {
      bodyLines.push(visibleCols.map(function(c) { return '"'+(r[c.k]||"").toString().replace(/"/g,'""')+'"'; }).join(","));
    });
    var blob = new Blob([bodyLines.join("\n")], {type:"text/csv"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "payroll-"+(batch?batch.period:"export")+".csv";
    a.click();
    setExportMenu(false);
  };

  var exportHTML = function() {
    var hdrs = visibleCols.map(function(c) { return "<th>"+c.label+"</th>"; }).join("");
    var bodyRows = sortedRows.map(function(r) {
      return "<tr>"+visibleCols.map(function(c) { return "<td>"+(parseFloat(r[c.k]||0).toFixed(2)||r[c.k]||"")+"</td>"; }).join("")+"</tr>";
    }).join("");
    var html = "<html><head><title>Payroll</title><style>body{font-family:sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px}th{background:#EBF6FC}</style></head><body><h2>Payroll - "+(batch?batch.period:"")+"</h2><table><thead><tr>"+hdrs+"</tr></thead><tbody>"+bodyRows+"</tbody></table></body></html>";
    var blob = new Blob([html], {type:"text/html"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "payroll-"+(batch?batch.period:"")+".html";
    a.click();
    setExportMenu(false);
  };

  var deptSummary = (function() {
    var map = {};
    allRows.forEach(function(r) {
      if (!map[r.dept]) map[r.dept] = {dept:r.dept,count:0,gross:0,net:0,epfEe:0,pcb:0,deduct:0};
      map[r.dept].count++;
      map[r.dept].gross  += r.grossTotal;
      map[r.dept].net    += r.netTotal;
      map[r.dept].epfEe  += r.epfEe;
      map[r.dept].pcb    += r.pcb;
      map[r.dept].deduct += r.totalDeduct;
    });
    var result = [];
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) result.push(map[keys[i]]);
    return result;
  })();

  var genPayroll = function() {
    var id = "PAY-" + genMonth;
    if (batches.find(function(b) { return b.id === id; })) { alert("Already exists!"); return; }
    var parts = genMonth.split("-");
    var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var period = MONTHS[parseInt(parts[1])-1] + " " + parts[0];
    setBatches(function(prev) {
      return [{id:id,period:period,month:genMonth,wd:genWd,status:"Draft",created:new Date().toISOString().slice(0,10),by:"Ahmad Farid"}].concat(prev);
    });
    setSelId(id); setShowGen(false); setTab("detail");
  };

  var act = function(action, id) {
    var statusMap = {confirm:"Confirmed",pay:"Paid",cancel:"Cancelled"};
    if (statusMap[action]) {
      setBatches(function(prev) { return prev.map(function(b) { return b.id===id ? Object.assign({},b,{status:statusMap[action]}) : b; }); });
    } else if (action === "delete") {
      setBatches(function(prev) { return prev.filter(function(b) { return b.id!==id; }); });
      setSelId(null);
    } else if (action === "reopen") {
      setBatches(function(prev) { return prev.map(function(b) { return b.id===id ? Object.assign({},b,{status:"Draft"}) : b; }); });
    }
    setDlg(null);
  };

  var dlgCfgs = {
    confirm:{icon:<CheckCircle size={20}/>,title:"Confirm Payroll",msg:"Lock for bank file generation.",c:C.green,btn:"Confirm"},
    pay:{icon:<DollarSign size={20}/>,title:"Mark as Paid",msg:"Mark as disbursed. Cannot be undone.",c:C.accent,btn:"Mark Paid"},
    cancel:{icon:<AlertTriangle size={20}/>,title:"Cancel Payroll",msg:"Cancel this batch.",c:C.amber,btn:"Cancel"},
    delete:{icon:<Trash2 size={20}/>,title:"Delete Payroll",msg:"Permanently delete.",c:C.red,btn:"Delete"},
    reopen:{icon:<RotateCcw size={20}/>,title:"Re-open to Draft",msg:"Revert to Draft for editing.",c:C.amber,btn:"Re-open"},
  };
  var dlgCfg = dlg ? dlgCfgs[dlg.action] : null;

  return (
    <div>
      <PayrollDrillModal drillRow={drillRow} setDrillRow={setDrillRow} drillTab={drillTab} setDrillTab={setDrillTab} batch={batch} employees={employees} />
      <PayrollColPicker colMenu={colMenu} setColMenu={setColMenu} visCols={visCols} setVisCols={setVisCols} ALL_COLS={ALL_COLS} DEFAULT_VIS={DEFAULT_VIS} exportMenu={exportMenu} setExportMenu={setExportMenu} toggleCol={toggleCol} />
      <PayrollExportMenu exportMenu={exportMenu} setExportMenu={setExportMenu} visibleCols={visibleCols} sortedRows={sortedRows} batch={batch} co={co} exportCSV={exportCSV} exportHTML={exportHTML} />

      {dlg && dlgCfg && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,.55)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:C.card,borderRadius:16,padding:32,maxWidth:380,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>{dlgCfg.icon}</div>
            <div style={{color:C.tp,fontWeight:800,fontSize:17,marginBottom:8}}>{dlgCfg.title}</div>
            <div style={{color:C.ts,fontSize:13,lineHeight:1.7,marginBottom:24}}>{dlgCfg.msg}</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn c={C.ts} onClick={function(){setDlg(null);}}>Back</Btn>
              <Btn c={dlgCfg.c} onClick={function(){act(dlg.action,dlg.id);}}>{dlgCfg.btn}</Btn>
            </div>
          </div>
        </div>
      )}

      <SectionHead title="Payroll Engine"
        sub={(co.name||"HRCloud") + " - Generate, Review, Confirm, Disburse"}
        action={
          <div style={S.rowG8}>
            <Btn c={C.purple} onClick={function(){setExportMenu(function(v){return !v;});}}>Export</Btn>
            <Btn c={C.green} onClick={function(){setShowGen(true);}}>Generate Payroll</Btn>
          </div>        } />

      {showGen && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <Card style={{width:500,padding:32}}>
            <div style={{color:C.tp,fontWeight:800,fontSize:17,marginBottom:4}}>Generate Payroll</div>
            <div style={{color:C.ts,fontSize:13,marginBottom:20}}>Select month and working days.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
              <div>
                <label style={S.ts11b}>PAYROLL MONTH</label>
                <input type="month" value={genMonth} onChange={function(e){setGenMonth(e.target.value);}} style={Object.assign({},inputStyle)} />
              </div>
              <div>
                <label style={S.ts11b}>WORKING DAYS</label>
                <select value={genWd} onChange={function(e){setGenWd(parseInt(e.target.value));}} style={Object.assign({},selectStyle,{width:"100%"})}>
                  {[20,21,22,23,24,25,26,27,28].map(function(d){return <option key={d} value={d}>{d} days</option>;})}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn c={C.ts} onClick={function(){setShowGen(false);}}>Cancel</Btn>
              <Btn c={C.green} onClick={genPayroll}>Generate</Btn>
            </div>
          </Card>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16}}>
        <div>
          <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"0.8px",marginBottom:8}}>PAYROLL HISTORY</div>
          <Card noPad style={{overflow:"hidden"}}>
            {batches.map(function(b,i) {
              return (
                <div key={b.id} onClick={function(){setSelId(b.id); setTab("detail");}} style={{padding:"12px 14px",cursor:"pointer",background:selId===b.id?C.accentL:"transparent",borderBottom:i<batches.length-1?"1px solid "+C.border+"55":"none"}}>
                  <div style={S.rowJSB}>
                    <div style={{color:selId===b.id?C.accent:C.tp,fontWeight:700,fontSize:13}}>{b.period}</div>
                    <StatusChip s={b.status} />
                  </div>
                  <div style={{color:C.ts,fontSize:11,marginTop:3}}>{b.wd} working days</div>
                </div>              );
            })}
          </Card>
        </div>

        <div>
          {batch ? (
            <div>
              <Card style={{marginBottom:12,padding:"14px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:hasSchedule?10:0}}>
                  <div>
                    <div style={{color:C.tp,fontWeight:800,fontSize:16}}>{batch.period}</div>
                    <div style={{color:C.ts,fontSize:12,marginTop:2}}>
                      {hasSchedule
                        ? employees.length+" employees - working days auto-calculated from schedule"
                        : batch.wd+" working days (manual) - "+employees.length+" employees"}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <StatusChip s={batch.status} />
                    {batch.status==="Draft"     && <Btn c={C.green} onClick={function(){setDlg({action:"confirm",id:batch.id});}}>Confirm</Btn>}
                    {batch.status==="Confirmed" && <Btn c={C.accent} onClick={function(){setDlg({action:"pay",id:batch.id});}}>Mark Paid</Btn>}
                    {batch.status==="Draft"     && <Btn sm c={C.red} onClick={function(){setDlg({action:"delete",id:batch.id});}}>Delete</Btn>}
                    {batch.status==="Confirmed" && <Btn sm c={C.amber} onClick={function(){setDlg({action:"reopen",id:batch.id});}}>Re-open</Btn>}
                  </div>
                </div>
                {hasSchedule && (
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {allRows.map(function(r) {
                      return (
                        <div key={r.empId} style={{background:C.greenL,borderRadius:6,padding:"4px 10px",display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{color:C.tp,fontSize:11,fontWeight:600}}>{r.name.split(" ")[0]}</span>
                          <span style={{color:C.green,fontSize:11,fontWeight:700}}>{r.schedWd}d</span>
                          <span style={S.ts10}>{r.schedHrsPerDay}h/d</span>
                          <span style={{color:C.accent,fontSize:10}}>{r.schedStart}-{r.schedEnd}</span>
                        </div>                      );
                    })}
                  </div>
                )}
                {!hasSchedule && (
                  <div style={{marginTop:6,padding:"6px 10px",background:C.amberL,borderRadius:6,color:C.amber,fontSize:11,fontWeight:600}}>
                    No schedule configured. Go to Staffing Schedule to set up working hours - salary will auto-calculate from actual days and hours.
                  </div>
                )}
              </Card>

              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                {[["detail","Payroll Detail"],["dept","By Department"],["employer","Employer Cost"],["summary","Summary"]].map(function(t) {
                  return (
                    <button key={t[0]} onClick={function(){setTab(t[0]);}} style={{background:tab===t[0]?C.accentL:"transparent",color:tab===t[0]?C.accent:C.ts,border:"1.5px solid "+(tab===t[0]?C.accent+"66":C.border),borderRadius:8,padding:"7px 18px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      {t[1]}
                    </button>                  );
                })}
              </div>

              {tab === "detail" && (
                <div>
                  <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
                    <input value={filterQ} onChange={function(e){setFilterQ(e.target.value);}} placeholder="Filter by name or dept..." style={Object.assign({},inputStyle,{width:220,marginBottom:0,fontSize:12})} />
                    <span style={S.ts11}>{sortedRows.length} of {allRows.length}</span>
                    <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                      <button onClick={function(e){var r=e.currentTarget.getBoundingClientRect();setColMenu({x:r.left,y:r.bottom+4});setExportMenu(false);}} style={{background:C.surface,border:"1.5px solid "+C.border,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",color:C.ts,fontFamily:"inherit"}}>
                        Columns ({visCols.length})
                      </button>
                      <button onClick={function(){setVisCols(DEFAULT_VIS);setFilterQ("");setSortKey("name");setSortDir("asc");}} style={{background:C.surface,border:"1.5px solid "+C.border,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",color:C.ts,fontFamily:"inherit"}}>
                        Reset
                      </button>
                    </div>
                  </div>
                  <Card noPad style={{overflow:"hidden"}}>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead>
                          <tr style={{background:C.surface}}>
                            {visibleCols.map(function(col) {
                              var isSorted = sortKey === col.k;
                              return (
                                <th key={col.k} onClick={function(){handleSort(col.k);}} onContextMenu={function(e){e.preventDefault();var r=e.currentTarget.getBoundingClientRect();setColMenu({x:r.left,y:r.bottom+4});}} style={{padding:"10px "+(col.align==="right"?"8px":"12px"),textAlign:col.align,color:isSorted?C.accent:C.ts,fontWeight:700,borderBottom:"2px solid "+C.border,cursor:"pointer",whiteSpace:"nowrap",userSelect:"none",background:isSorted?C.accentL:"transparent"}}>
                                  {col.label} {isSorted ? (sortDir==="asc"?"^":"v") : ""}
                                </th>                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRows.map(function(r,i) {
                            return (
                              <tr key={r.empId} onClick={function(){setDrillRow(r);setDrillTab("overview");}} style={{background:i%2===0?"transparent":"#F8FCFF",borderBottom:"1px solid "+C.border+"33",cursor:"pointer"}} onMouseEnter={function(e){e.currentTarget.style.background=C.accentL+"55";}} onMouseLeave={function(e){e.currentTarget.style.background=i%2===0?"transparent":"#F8FCFF";}}>
                                {visibleCols.map(function(col) {
                                  var val = r[col.k];
                                  return (
                                    <td key={col.k} style={{padding:"9px "+(col.align==="right"?"8px":"12px"),textAlign:col.align,color:col.color,fontWeight:col.k==="name"||col.k==="netTotal"||col.k==="grossTotal"?700:400}}>
                                      {col.k==="name" ? (
                                        <div>
                                          <div style={{color:C.tp,fontWeight:700}}>{val}</div>
                                          <div style={S.ts10}>{r.dept} - {r.empId}</div>
                                        </div>
                                      ) : (
                                        NUM_KEYS.indexOf(col.k) > -1 ? parseFloat(val||0).toFixed(2) : (val||"")
                                      )}
                                    </td>                                  );
                                })}
                              </tr>                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{background:C.surface,fontWeight:700,borderTop:"2px solid "+C.border}}>
                            {visibleCols.map(function(col,ci) {
                              var isNum = NUM_KEYS.indexOf(col.k) > -1;
                              return (
                                <td key={col.k} style={{padding:"9px "+(col.align==="right"?"8px":"12px"),textAlign:col.align,color:col.color,fontSize:ci===0?11:12}}>
                                  {ci===0 ? "TOTALS ("+sortedRows.length+")" : ci===1 ? "" : isNum ? sumF(sortedRows,col.k).toFixed(2) : ""}
                                </td>                              );
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div style={{padding:"8px 14px",background:C.surface,borderTop:"1px solid "+C.border,color:C.ts,fontSize:11}}>
                      Click any row to drill down. Right-click column header to manage columns.
                    </div>
                  </Card>
                </div>
              )}

              {tab === "dept" && (
                <div>
                  <Card noPad style={{overflow:"hidden",marginBottom:16}}>
                    <div style={{padding:"12px 16px",background:C.surface,borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={S.tp14b}>Payroll by Department</span>
                      <span style={S.ts12}>{batch.period}</span>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead>
                          <tr style={{background:C.surface}}>
                            {["Department","Headcount","Gross","Deductions","Net to Bank","EPF EE","PCB","% of Total"].map(function(h,hi) {
                              return <th key={h} style={{padding:"10px "+(hi>0?"8px":"12px"),textAlign:hi>0?"right":"left",color:C.ts,fontWeight:700,borderBottom:"2px solid "+C.border,whiteSpace:"nowrap"}}>{h}</th>;
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {deptSummary.map(function(d,i) {
                            var pct = T("grossTotal") > 0 ? (d.gross/T("grossTotal")*100).toFixed(1) : "0.0";
                            return (
                              <tr key={d.dept} style={{borderBottom:"1px solid "+C.border+"33",background:i%2===0?"transparent":"#F8FCFF"}}>
                                <td style={{padding:"10px 12px",color:C.tp,fontWeight:700}}>{d.dept}</td>
                                <td style={{padding:"10px 8px",textAlign:"right",color:C.accent,fontWeight:700}}>{d.count}</td>
                                <td style={{padding:"10px 8px",textAlign:"right",color:C.green,fontWeight:700}}>RM {d.gross.toFixed(2)}</td>
                                <td style={{padding:"10px 8px",textAlign:"right",color:C.red}}>RM {d.deduct.toFixed(2)}</td>
                                <td style={{padding:"10px 8px",textAlign:"right",color:C.green,fontWeight:800}}>RM {d.net.toFixed(2)}</td>
                                <td style={{padding:"10px 8px",textAlign:"right",color:C.green}}>RM {d.epfEe.toFixed(2)}</td>
                                <td style={{padding:"10px 8px",textAlign:"right",color:C.purple}}>RM {d.pcb.toFixed(2)}</td>
                                <td style={{padding:"10px 8px",textAlign:"right"}}>
                                  <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6}}>
                                    <div style={{width:40,height:6,background:C.surface,borderRadius:3,overflow:"hidden"}}>
                                      <div style={{width:pct+"%",height:"100%",background:C.accent,borderRadius:3}} />
                                    </div>
                                    <span style={{color:C.accent,fontWeight:600}}>{pct}%</span>
                                  </div>
                                </td>
                              </tr>                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{background:C.surface,fontWeight:700,borderTop:"2px solid "+C.border}}>
                            <td style={{padding:"9px 12px",color:C.ts,fontSize:11}}>TOTAL</td>
                            <td style={{padding:"9px 8px",textAlign:"right",color:C.accent}}>{allRows.length}</td>
                            <td style={{padding:"9px 8px",textAlign:"right",color:C.green}}>RM {T("grossTotal").toFixed(2)}</td>
                            <td style={{padding:"9px 8px",textAlign:"right",color:C.red}}>RM {T("totalDeduct").toFixed(2)}</td>
                            <td style={{padding:"9px 8px",textAlign:"right",color:C.green,fontSize:13}}>RM {T("netTotal").toFixed(2)}</td>
                            <td style={{padding:"9px 8px",textAlign:"right",color:C.green}}>RM {T("epfEe").toFixed(2)}</td>
                            <td style={{padding:"9px 8px",textAlign:"right",color:C.purple}}>RM {T("pcb").toFixed(2)}</td>
                            <td style={{padding:"9px 8px",textAlign:"right",color:C.accent}}>100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </Card>
                  <Card>
                    <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>Gross Payroll Distribution</div>
                    {deptSummary.map(function(d) {
                      var pct = T("grossTotal") > 0 ? d.gross/T("grossTotal")*100 : 0;
                      return (
                        <div key={d.dept} style={S.mb12}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{d.dept}</span>
                            <span style={S.ts12}>RM {d.gross.toFixed(2)} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div style={{background:C.surface,borderRadius:6,height:10,overflow:"hidden"}}>
                            <div style={{width:pct+"%",height:"100%",background:"linear-gradient(90deg,"+C.accent+","+C.accentD+")",borderRadius:6}} />
                          </div>
                        </div>                      );
                    })}
                  </Card>
                </div>
              )}

              {tab === "employer" && (
                <div>
                  <Card style={{marginBottom:12}}>
                    <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>Employer Statutory Contributions</div>
                    {[
                      ["EPF Employer (12–13%)",T("epfEr"),C.green,"Remit via i-Akaun Majikan by 15th"],
                      ["SOCSO Employer",T("socsoEr"),C.accent,"Remit via ASSIST Portal by 15th"],
                      ["EIS Employer",T("eisEr"),C.accent,"Remit via ASSIST Portal by 15th"],
                      ["HRDF Levy (1%)",T("hrdf"),C.amber,"Remit via HRD Corp Portal by 15th"],
                    ].map(function(item) {
                      return (
                        <div key={item[0]} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+C.border+"44"}}>
                          <div>
                            <div style={S.ts13}>{item[0]}</div>
                            <div style={{color:C.tm,fontSize:10,marginTop:1}}>{item[3]}</div>
                          </div>
                          <span style={{color:item[2],fontWeight:700,fontSize:13}}>{rm(item[1])}</span>
                        </div>                      );
                    })}
                    <div style={{marginTop:12,background:C.redL,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between"}}>
                      <span style={{color:C.ts,fontWeight:700}}>Total Employer Cost</span>
                      <span style={{color:C.red,fontWeight:900,fontSize:16}}>{rm(T("grossTotal")+T("epfEr")+T("socsoEr")+T("eisEr")+T("hrdf"))}</span>
                    </div>
                  </Card>
                  <Card>
                    <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:12}}>CP38 — LHDN Instalment Orders</div>
                    <div style={{background:C.amberL,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:"#92400E",lineHeight:1.6}}>
                      CP38 is a court order by LHDN/IRB instructing the employer to deduct a fixed monthly instalment from the employee's salary and remit directly to IRB. These are additional to normal PCB and must be paid separately via MyTax.
                    </div>
                    {(function(){
                      var cp38Emps = allRows.filter(function(r){return r.cp38>0;});
                      if (cp38Emps.length === 0) return (
                        <div style={{color:C.ts,fontSize:12,textAlign:"center",padding:"16px 0"}}>No CP38 orders active this period.</div>
                      );
                      return (
                        <div>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead>
                              <tr style={{background:C.surface}}>
                                {["Employee","Ref No.","Instalment From","Instalment To","Monthly (RM)"].map(function(h){
                                  return <th key={h} style={{padding:"8px 10px",textAlign:"left",color:C.ts,fontWeight:700,borderBottom:"2px solid "+C.border}}>{h}</th>;
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {cp38Emps.map(function(r,i){
                                var emp_r = allRows && employees ? (employees.find(function(e){return e.id===r.empId;})||{}) : {};
                                return (
                                  <tr key={r.empId} style={{background:i%2===0?"transparent":"#F8FCFF",borderBottom:"1px solid "+C.border+"33"}}>
                                    <td style={{padding:"8px 10px",color:C.tp,fontWeight:700}}>{r.name}<div style={{color:C.ts,fontSize:10}}>{r.dept} · {r.empId}</div></td>
                                    <td style={{padding:"8px 10px",color:C.accent,fontWeight:600}}>{emp_r.cp38Ref||"—"}</td>
                                    <td style={{padding:"8px 10px",color:C.ts}}>{emp_r.cp38DateFrom||"—"}</td>
                                    <td style={{padding:"8px 10px",color:C.ts}}>{emp_r.cp38DateTo||"—"}</td>
                                    <td style={{padding:"8px 10px",color:C.red,fontWeight:700,textAlign:"right"}}>RM {r.cp38.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{background:C.surface,fontWeight:700,borderTop:"2px solid "+C.border}}>
                                <td style={{padding:"8px 10px",color:C.ts,fontSize:11}} colSpan={4}>TOTAL CP38 THIS PERIOD</td>
                                <td style={{padding:"8px 10px",color:C.red,fontWeight:900,textAlign:"right"}}>RM {cp38Emps.reduce(function(s,r){return s+r.cp38;},0).toFixed(2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                          <div style={{marginTop:10,padding:"8px 12px",background:C.purpleL,borderRadius:8,fontSize:11,color:C.purple,fontWeight:600}}>
                            ⚡ Remit CP38 separately to LHDN via MyTax portal — do NOT combine with PCB payment.
                          </div>
                        </div>
                      );
                    })()}
                  </Card>
                </div>
              )}

              {tab === "summary" && (
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                  {[{l:"Gross Payroll",v:T("grossTotal"),c:C.green,bg:C.greenL},{l:"Total Deductions",v:T("totalDeduct"),c:C.red,bg:C.redL},{l:"Net to Bank",v:T("netTotal"),c:C.accent,bg:C.accentL},{l:"EPF Employee",v:T("epfEe"),c:C.green,bg:C.greenL},{l:"SOCSO + EIS",v:T("socsoEe")+T("eisEe"),c:C.accent,bg:C.accentL},{l:"PCB (MTD)",v:T("pcb"),c:C.purple,bg:C.purpleL}].map(function(item) {
                    return (
                      <Card key={item.l} style={{background:item.bg,padding:"16px 18px"}}>
                        <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"0.5px"}}>{item.l.toUpperCase()}</div>
                        <div style={{color:item.c,fontSize:20,fontWeight:900,marginTop:4}}>{rm(item.v)}</div>
                      </Card>                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <Card style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:320}}>
              <div style={{fontSize:56,marginBottom:16}}>💰</div>
              <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:6}}>Select a payroll batch</div>
              <div style={S.ts13}>Or generate a new payroll to get started</div>
            </Card>
          )}
        </div>
      </div>
    </div>  );
}

// -- STATUTORY MODULE
// -- Shared calculator input component
function CalcInput(props) {
  var label = props.label, value = props.value, onChange = props.onChange, onEnter = props.onEnter;
  var type = props.type || "number";
  return (
    <div style={S.mb12}>
      <label style={{color:C.ts,fontSize:11,fontWeight:700,display:"block",marginBottom:5,letterSpacing:"0.5px"}}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onKeyDown={function(e){ if(e.key==="Enter" && onEnter) onEnter(); }}
        style={Object.assign({},inputStyle,{marginBottom:0})}
      />
    </div>  );
}

// -- Result row inside a result box
function CalcResultRow(props) {
  var label = props.label, value = props.value, color = props.color, big = props.big, border = props.border;
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:big?"10px 0":"7px 0",
      borderBottom:border?"1px solid "+C.border+"55":"none"}}>
      <span style={{color:C.ts,fontSize:big?13:12,fontWeight:big?700:400}}>{label}</span>
      <span style={{color:color||C.green,fontWeight:700,fontSize:big?16:13}}>{value}</span>
    </div>  );
}

// -- EPF Calculator
function EpfCalc() {
  var [wageInput, setWageInput] = useState("");
  var [ageInput, setAgeInput] = useState("");
  var [result, setResult] = useState(null);
  var [err, setErr] = useState("");

  var calculate = function() {
    var wage = parseFloat(wageInput);
    var age = parseInt(ageInput);
    if (!wageInput || isNaN(wage) || wage <= 0) { setErr("Please enter a valid wage."); setResult(null); return; }
    if (!ageInput || isNaN(age) || age < 18 || age > 100) { setErr("Please enter a valid age (18-100)."); setResult(null); return; }
    setErr("");
    var res = getEpf(wage, age, null, null);
    var eeRate = age >= 60 ? 0 : age >= 55 ? 5.5 : 11;
    var erRate = age >= 60 ? 4 : age >= 55 ? 6.5 : wage <= 5000 ? 13 : 12;
    setResult({ ee: res.ee, er: res.er, total: res.ee + res.er, wage: wage, age: age, eeRate: eeRate, erRate: erRate });
  };

  return (
    <div>
      <CalcInput label="BASIC WAGE (RM)" value={wageInput} onChange={function(e){setWageInput(e.target.value);}} onEnter={calculate} />
      <CalcInput label="EMPLOYEE AGE" value={ageInput} onChange={function(e){setAgeInput(e.target.value);}} onEnter={calculate} />
      {err && <div style={{color:C.red,fontSize:12,marginBottom:10,padding:"6px 10px",background:C.redL,borderRadius:6}}>{err}</div>}
      <button onClick={calculate} style={{
        width:"100%",background:"linear-gradient(135deg,"+C.green+",#047857)",color:"#fff",
        border:"none",borderRadius:8,padding:"10px 0",fontSize:13,fontWeight:700,
        cursor:"pointer",fontFamily:"inherit",marginBottom:result?14:0,letterSpacing:"0.3px",
      }}>Calculate EPF (or press Enter)</button>
      {result && (
        <div style={{background:C.greenL,border:"1.5px solid "+C.green+"44",borderRadius:12,padding:"16px 18px"}}>
          <div style={{color:C.green,fontWeight:800,fontSize:12,letterSpacing:"0.8px",marginBottom:10}}>RESULT - MONTHLY EPF</div>
          <CalcResultRow label={"Employee (EE) @ "+result.eeRate+"%"} value={rm(result.ee)} color={C.green} border={true} />
          <CalcResultRow label={"Employer (ER) @ "+result.erRate+"%"} value={rm(result.er)} color={C.tp} border={true} />
          <CalcResultRow label="Total EPF" value={rm(result.total)} color={C.green} big={true} />
          <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed "+C.border,color:C.ts,fontSize:11}}>
            Wage: RM {result.wage.toLocaleString()} | Age: {result.age} | Category: {result.age >= 60 ? "Age 60+" : result.age >= 55 ? "Age 55-59" : "Standard"}
          </div>
        </div>
      )}
    </div>  );
}

// -- SOCSO Calculator
function SocsoCalc() {
  var [wageInput, setWageInput] = useState("");
  var [cat, setCat] = useState("1");
  var [result, setResult] = useState(null);
  var [err, setErr] = useState("");

  var calculate = function() {
    var wage = parseFloat(wageInput);
    if (!wageInput || isNaN(wage) || wage <= 0) { setErr("Please enter a valid insurable wage."); setResult(null); return; }
    setErr("");
    var catNum = parseInt(cat);
    var res = getSocso(wage, catNum);
    var cappedWage = Math.min(wage, 6000);
    setResult({ ee: res.ee, er: res.er, total: res.ee + res.er, wage: wage, cappedWage: cappedWage, cat: catNum });
  };

  return (
    <div>
      <CalcInput label="INSURABLE WAGE (RM)" value={wageInput} onChange={function(e){setWageInput(e.target.value);}} onEnter={calculate} />
      <div style={S.mb12}>
        <label style={{color:C.ts,fontSize:11,fontWeight:700,display:"block",marginBottom:5,letterSpacing:"0.5px"}}>SOCSO CATEGORY</label>
        <div style={S.rowG8}>
          {[["1","Cat 1 - Below age 60"],["2","Cat 2 - Age 60+"]].map(function(opt) {
            return (
              <button key={opt[0]} onClick={function(){setCat(opt[0]);}} style={{
                flex:1,padding:"8px 0",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                background:cat===opt[0]?C.accentL:"transparent",
                color:cat===opt[0]?C.accent:C.ts,
                border:"1.5px solid "+(cat===opt[0]?C.accent+"66":C.border),
              }}>{opt[1]}</button>            );
          })}
        </div>
      </div>
      {err && <div style={{color:C.red,fontSize:12,marginBottom:10,padding:"6px 10px",background:C.redL,borderRadius:6}}>{err}</div>}
      <button onClick={calculate} style={{
        width:"100%",background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",color:"#fff",
        border:"none",borderRadius:8,padding:"10px 0",fontSize:13,fontWeight:700,
        cursor:"pointer",fontFamily:"inherit",marginBottom:result?14:0,letterSpacing:"0.3px",
      }}>Calculate SOCSO (or press Enter)</button>
      {result && (
        <div style={{background:C.accentL,border:"1.5px solid "+C.accent+"44",borderRadius:12,padding:"16px 18px"}}>
          <div style={{color:C.accent,fontWeight:800,fontSize:12,letterSpacing:"0.8px",marginBottom:10}}>RESULT - MONTHLY SOCSO</div>
          <CalcResultRow label="Employee Contribution (EE)" value={result.ee > 0 ? rm(result.ee) : "RM 0.00 (Exempt)"} color={result.ee > 0 ? C.accent : C.ts} border={true} />
          <CalcResultRow label="Employer Contribution (ER)" value={rm(result.er)} color={C.tp} border={true} />
          <CalcResultRow label="Total SOCSO" value={rm(result.total)} color={C.accent} big={true} />
          <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed "+C.border,color:C.ts,fontSize:11}}>
            {result.wage > 6000 ? "Wage capped at RM 6,000 (ceiling applies)" : "Wage: RM "+result.wage.toLocaleString()} | Cat {result.cat}: {result.cat===1?"Employment Injury + Invalidity":"Employment Injury only"}
          </div>
        </div>
      )}
    </div>  );
}

// -- EIS Calculator
function EisCalc() {
  var [wageInput, setWageInput] = useState("");
  var [ageInput, setAgeInput] = useState("");
  var [result, setResult] = useState(null);
  var [err, setErr] = useState("");

  var calculate = function() {
    var wage = parseFloat(wageInput);
    var age = parseInt(ageInput);
    if (!wageInput || isNaN(wage) || wage <= 0) { setErr("Please enter a valid wage."); setResult(null); return; }
    if (!ageInput || isNaN(age) || age < 18 || age > 100) { setErr("Please enter a valid age (18-100)."); setResult(null); return; }
    setErr("");
    var res = getEis(wage, age);
    setResult({ ee: res.ee, er: res.er, total: res.ee + res.er, wage: wage, age: age, exempt: age >= 60 });
  };

  return (
    <div>
      <CalcInput label="INSURABLE WAGE (RM)" value={wageInput} onChange={function(e){setWageInput(e.target.value);}} onEnter={calculate} />
      <CalcInput label="EMPLOYEE AGE" value={ageInput} onChange={function(e){setAgeInput(e.target.value);}} onEnter={calculate} />
      {err && <div style={{color:C.red,fontSize:12,marginBottom:10,padding:"6px 10px",background:C.redL,borderRadius:6}}>{err}</div>}
      <button onClick={calculate} style={{
        width:"100%",background:"linear-gradient(135deg,"+C.purple+",#5b21b6)",color:"#fff",
        border:"none",borderRadius:8,padding:"10px 0",fontSize:13,fontWeight:700,
        cursor:"pointer",fontFamily:"inherit",marginBottom:result?14:0,letterSpacing:"0.3px",
      }}>Calculate EIS (or press Enter)</button>
      {result && (
        <div style={{background:result.exempt?C.surface:C.purpleL,border:"1.5px solid "+(result.exempt?C.border:C.purple+"44"),borderRadius:12,padding:"16px 18px"}}>
          {result.exempt ? (
            <div style={{textAlign:"center",padding:"8px 0"}}>
              <div style={{fontSize:32,marginBottom:8}}>🚫</div>
              <div style={{color:C.amber,fontWeight:700,fontSize:14}}>EIS Exempt</div>
              <div style={{color:C.ts,fontSize:12,marginTop:4}}>Age {result.age} is 60 or above - fully exempt from EIS (Akta 800)</div>
            </div>
          ) : (
            <div>
              <div style={{color:C.purple,fontWeight:800,fontSize:12,letterSpacing:"0.8px",marginBottom:10}}>RESULT - MONTHLY EIS</div>
              <CalcResultRow label="Employee Contribution (EE) @ 0.2%" value={rm(result.ee)} color={C.purple} border={true} />
              <CalcResultRow label="Employer Contribution (ER) @ 0.2%" value={rm(result.er)} color={C.tp} border={true} />
              <CalcResultRow label="Total EIS" value={rm(result.total)} color={C.purple} big={true} />
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed "+C.border,color:C.ts,fontSize:11}}>
                {result.wage > 6000 ? "Wage capped at RM 6,000 (ceiling applies)" : "Wage: RM "+result.wage.toLocaleString()} | Age: {result.age} | EE = ER (both 0.2%)
              </div>
            </div>
          )}
        </div>
      )}
    </div>  );
}


// ─────────────────────────────────────────────────────────────────────────────
// PCB VERIFICATION TOOL  — Full step-by-step LHDN MTD/PCB audit for HR
// Select any employee + any payroll month → see every relief, bracket, deduction
// ─────────────────────────────────────────────────────────────────────────────
function PcbVerificationTool(props) {
  var employees    = props.employees    || [];
  var payrollConfig= props.payrollConfig|| INIT_PAYROLL_CONFIG;
  var gSched       = props.gSched       || {};
  var gWh          = props.gWh          || {};
  var gUnified     = props.gUnified     || {};
  var gSchedMode   = props.gSchedMode   || "off";
  // Live batches from global state — includes any Draft batches generated in Payroll module
  var liveBatches  = props.batches      || PAYROLL_BATCHES_INIT;

  // Build month options directly from live batches — sorted newest first
  var monthOptions = liveBatches.slice().sort(function(a,b){
    return b.month.localeCompare(a.month);
  }).map(function(b){
    return {value:b.month, label:b.period, wd:b.wd, status:b.status, id:b.id};
  });

  var [selEmpId,  setSelEmpId]  = useState(employees.length ? employees[0].id : "");
  var [selMonth,  setSelMonth]  = useState(monthOptions.length ? monthOptions[0].value : "");
  var [showGuide, setShowGuide] = useState(false);

  var emp = employees.find(function(e){return e.id===selEmpId;}) || employees[0] || null;
  var monthOpt = monthOptions.find(function(o){return o.value===selMonth;}) || monthOptions[0];
  var wd = monthOpt ? monthOpt.wd : 26;

  // ── Compute payroll row for this emp + month ────────────────────────────
  var row = null;
  if (emp) {
    var ss = computeScheduleStats(emp.id, selMonth, gSched, gWh, gUnified, gSchedMode);
    var ovWithMonth = {_batchMonth: selMonth};
    row = computeRow(emp, wd, ovWithMonth, ss, payrollConfig);
  }

  // ── PCB Relief breakdown — LHDN PCB/MTD correct methodology ────────────
  // EPF relief = actual 11% employee contribution on basic salary (not payroll row value)
  //   capped at RM 4,000 per year.
  // Self relief (RM 9,000) = mandatory personal relief per s.46(1)(a) Income Tax Act,
  //   always included in annual chargeable income calc — NOT a monthly deduction line.
  // Accumulated PCB = sum of PCB already deducted in prior months of the same tax year
  //   (from earlier batches), used for reconciliation of remaining tax due.
  var relief = null;
  if (emp && row) {
    var taxYear   = selMonth ? selMonth.slice(0,4) : "2025";

    // ── EPF Relief: 11% of basic salary × 12, capped RM 4,000 ──────────
    var epfMonthly   = (row.basic || 0) * 0.11;          // EE 11% on basic
    var epfAnnual    = epfMonthly * 12;
    var epfRelief    = Math.min(epfAnnual, 4000);         // relief capped RM 4,000

    // ── Life Insurance + EPF combined cap RM 7,000 ──────────────────────
    var lifeIns      = parseFloat(emp.lifeInsurance)||0;
    var combLifeEpf  = Math.min(epfRelief + lifeIns, 7000);
    var lifeRelief   = combLifeEpf - epfRelief;

    var medIns       = Math.min(parseFloat(emp.medicalInsurance)||0, 3000);

    // ── Self Relief: RM 9,000 mandatory annual personal relief ──────────
    // Per LHDN s.46(1)(a) — auto-applied, not a claimed item
    var selfR        = 9000;
    var selfDis      = emp.selfDisabled ? 6000 : 0;
    var selfStudyR   = emp.selfStudying ? Math.min(parseFloat(emp.educationFees)||7000, 7000) : 0;

    var spouseR      = emp.spouseRelief ? 4000 : 0;
    var spouseDisR   = (emp.spouseRelief && emp.spouseDisabled) ? 3500 : 0;
    var medSelf      = Math.min(parseFloat(emp.medicalSelf)||0,    10000);
    var medParents   = Math.min(parseFloat(emp.medicalParents)||0,  8000);
    var disEquip     = Math.min(parseFloat(emp.disabilityEquipment)||0, 6000);
    var breastfeed   = Math.min(parseFloat(emp.breastfeeding)||0,   1000);
    var childcare    = Math.min(parseFloat(emp.childcareRelief)||0, 3000);
    var sport        = Math.min(parseFloat(emp.sportEquipment)||0,  1000);
    var domTour      = Math.min(parseFloat(emp.domesticTourism)||0, 1000);
    var evCharge     = Math.min(parseFloat(emp.electricVehicleCharge)||0, 2500);
    var prs          = Math.min(parseFloat(emp.privateRetirement)||0, 3000);
    var ssp          = Math.min(parseFloat(emp.sspRelief)||0, 3000);

    var kids         = emp.childrenDetails || [];
    var childRelief  = kids.length ? calcChildRelief(kids) : (parseInt(emp.pcbChildren)||0) * 2000;

    var totalRelief  = selfR + selfDis + selfStudyR + combLifeEpf + medIns +
      spouseR + spouseDisR + childRelief +
      medSelf + medParents + disEquip + breastfeed +
      childcare + sport + domTour + evCharge + prs + ssp;

    var annual       = (row.basic || 0) * 12;
    var chargeable   = Math.max(0, annual - totalRelief);

    // ── Progressive tax brackets (YA 2024) ──────────────────────────────
    var BRACKETS = [
      {label:"First RM 5,000",          floor:0,       ceil:5000,    rate:0.00},
      {label:"RM 5,001 – RM 20,000",    floor:5000,    ceil:20000,   rate:0.01},
      {label:"RM 20,001 – RM 35,000",   floor:20000,   ceil:35000,   rate:0.03},
      {label:"RM 35,001 – RM 50,000",   floor:35000,   ceil:50000,   rate:0.06},
      {label:"RM 50,001 – RM 70,000",   floor:50000,   ceil:70000,   rate:0.11},
      {label:"RM 70,001 – RM 100,000",  floor:70000,   ceil:100000,  rate:0.19},
      {label:"RM 100,001 – RM 250,000", floor:100000,  ceil:250000,  rate:0.25},
      {label:"Above RM 250,000",        floor:250000,  ceil:Infinity,rate:0.28},
    ];
    var bracketRows = []; var remaining = chargeable; var taxTotal = 0;
    for (var bi = 0; bi < BRACKETS.length; bi++) {
      var br = BRACKETS[bi];
      if (remaining <= 0) { bracketRows.push({label:br.label,taxable:0,rate:br.rate,tax:0,active:false}); continue; }
      var taxable2 = Math.min(remaining, br.ceil === Infinity ? remaining : (br.ceil - br.floor));
      var brTax    = taxable2 * br.rate;
      taxTotal    += brTax;
      bracketRows.push({label:br.label, taxable:taxable2, rate:br.rate, tax:brTax, active:taxable2>0});
      remaining   -= taxable2;
    }
    var annualTax  = taxTotal;
    var monthlyPCB = Math.round(annualTax / 12);

    // ── CP38 active this month? ──────────────────────────────────────────
    var cp38Active = false;
    if (emp.cp38Amount > 0 && emp.cp38DateFrom && emp.cp38DateTo) {
      var mFrom = emp.cp38DateFrom.slice(0,7);
      var mTo   = emp.cp38DateTo.slice(0,7);
      if (selMonth >= mFrom && selMonth <= mTo) cp38Active = true;
    }

    // ── Accumulated PCB reconciliation ──────────────────────────────────
    // Find all batches in the SAME TAX YEAR that come BEFORE the selected month
    // (i.e. earlier months in same year = PCB already paid/deducted)
    var priorBatches = liveBatches.filter(function(b) {
      return b.month && b.month.slice(0,4) === taxYear &&
             b.month < selMonth &&
             (b.status === "Paid" || b.status === "Confirmed" || b.status === "Draft");
    }).sort(function(a,b){ return a.month.localeCompare(b.month); });

    // For each prior batch, compute this employee's PCB
    var accumRows = priorBatches.map(function(pb) {
      var pss = computeScheduleStats(emp.id, pb.month, gSched, gWh, gUnified, gSchedMode);
      var pov = {_batchMonth: pb.month};
      var prow = computeRow(emp, pb.wd, pov, pss, payrollConfig);
      return {month: pb.month, period: pb.period, status: pb.status, pcb: prow.pcb};
    });
    var pcbAccumulated = accumRows.reduce(function(s, r){ return s + (r.pcb||0); }, 0);

    // Months already passed this year (prior batches count) vs remaining
    var selMonthNum    = parseInt(selMonth.slice(5,7)) || 1;  // 1-12
    var monthsElapsed  = priorBatches.length;  // months with PCB already paid
    var monthsRemaining= 12 - monthsElapsed;   // months left including current
    var taxRemaining   = Math.max(0, annualTax - pcbAccumulated);
    var adjustedMonthlyPCB = monthsRemaining > 0 ? Math.round(taxRemaining / monthsRemaining) : 0;

    relief = {
      annual, taxYear,
      epfMonthly, epfAnnual, epfRelief,
      lifeIns, lifeRelief, combLifeEpf, medIns,
      selfR, selfDis, selfStudyR, spouseR, spouseDisR,
      childRelief, kids,
      medSelf, medParents, disEquip, breastfeed,
      childcare, sport, domTour, evCharge, prs, ssp,
      totalRelief, chargeable,
      bracketRows, annualTax, monthlyPCB,
      cp38Active, cp38Amt: emp.cp38Amount||0,
      totalDeductMonthly: monthlyPCB + (cp38Active ? (emp.cp38Amount||0) : 0),
      // Accumulation reconciliation
      accumRows, pcbAccumulated, monthsElapsed, monthsRemaining,
      taxRemaining, adjustedMonthlyPCB,
      adjustedTotal: adjustedMonthlyPCB + (cp38Active ? (emp.cp38Amount||0) : 0),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  var rmf = function(n){ return "RM "+(parseFloat(n)||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var pct = function(r){ return (r*100).toFixed(0)+"%"; };

  var ReliefRow = function(p) {
    if (!p.show && p.show !== undefined) return null;
    return (
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
        padding:"7px 10px",borderBottom:"1px solid "+C.border+"33",
        background:p.highlight?"rgba(124,58,237,.04)":"transparent"}}>
        <div>
          <span style={{color:p.sub?C.ts:C.tp, fontSize:p.sub?11:12}}>{p.label}</span>
          {p.cap && <span style={{color:C.tm,fontSize:10,marginLeft:6}}>(max {p.cap})</span>}
          {p.badge && <span style={{background:C.purpleL,color:C.purple,fontSize:9,fontWeight:700,borderRadius:4,padding:"1px 5px",marginLeft:6}}>{p.badge}</span>}
        </div>
        <span style={{color:p.zero?C.tm:C.green, fontWeight:p.bold?700:500, fontSize:p.bold?13:12,
          textDecoration:p.zero?"line-through":"none"}}>
          {p.zero ? rmf(0) : rmf(p.value)}
        </span>
      </div>
    );
  };

  var SectionLabel = function(p) {
    return (
      <div style={{padding:"6px 10px",background:C.surface,borderBottom:"1px solid "+C.border,
        color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"0.6px",marginTop:p.mt?8:0}}>
        {p.label}
      </div>
    );
  };

  if (!emp) return (
    <div style={{textAlign:"center",padding:"60px 20px"}}>
      <div style={{fontSize:48,marginBottom:12}}>👥</div>
      <div style={{color:C.tp,fontWeight:700,fontSize:15}}>No employees found</div>
      <div style={{color:C.ts,fontSize:13,marginTop:6}}>Add employees in the Employee Master module first.</div>
    </div>
  );

  return (
    <div>
      {/* ── Top Reference Bar ─────────────────────────────────────────── */}
      <div style={{background:"linear-gradient(135deg,#4F46E5,#7C3AED)",borderRadius:14,
        padding:"18px 22px",marginBottom:20,color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,marginBottom:3}}>PCB / MTD Verification Tool</div>
            <div style={{fontSize:12,opacity:.85}}>Step-by-step LHDN Potongan Cukai Bulanan audit • Income Tax Act 1967 s.107C • YA 2024</div>
          </div>
          <button onClick={function(){setShowGuide(function(v){return !v;});}}
            style={{background:"rgba(255,255,255,.18)",border:"1.5px solid rgba(255,255,255,.35)",
              color:"#fff",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit"}}>
            {showGuide?"Hide Guide":"📖 LHDN Guide"}
          </button>
        </div>
        {/* KPI strip */}
        {relief && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:16}}>
            {[
              ["Annual Income",rmf(relief.annual),"#A5B4FC"],
              ["Total Relief",rmf(relief.totalRelief),"#6EE7B7"],
              ["Chargeable Income",rmf(relief.chargeable),"#FCD34D"],
              ["Monthly PCB",rmf(relief.monthlyPCB),"#FCA5A5"],
            ].map(function(item){
              return (
                <div key={item[0]} style={{background:"rgba(0,0,0,.20)",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{color:item[2],fontSize:10,fontWeight:700,marginBottom:3,letterSpacing:"0.4px"}}>{item[0].toUpperCase()}</div>
                  <div style={{color:"#fff",fontWeight:900,fontSize:16}}>{item[1]}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── LHDN Quick Guide (collapsible) ──────────────────────────── */}
      {showGuide && (
        <div style={{background:"#FFF7ED",border:"1.5px solid #FED7AA",borderRadius:12,
          padding:"16px 18px",marginBottom:18,fontSize:12,lineHeight:1.7,color:"#7C2D12"}}>
          <div style={{fontWeight:800,fontSize:13,marginBottom:8,color:"#9A3412"}}>📋 How LHDN PCB / MTD is Calculated</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
            <div>
              <div style={{fontWeight:700,marginBottom:4}}>Step 1 — Annual Income</div>
              <div>Take monthly basic salary × 12 months.</div>
              <div style={{fontWeight:700,margin:"8px 0 4px"}}>Step 2 — Deduct All Reliefs</div>
              <div>Personal (RM 9,000), EPF (max RM 4,000), spouse, children, insurance, etc.</div>
              <div style={{fontWeight:700,margin:"8px 0 4px"}}>Step 3 — Chargeable Income</div>
              <div>Annual Income − Total Relief = Chargeable Income.</div>
            </div>
            <div>
              <div style={{fontWeight:700,marginBottom:4}}>Step 4 — Apply Tax Brackets</div>
              <div>Progressive rates 0%–28% applied in layers per YA 2024 schedule.</div>
              <div style={{fontWeight:700,margin:"8px 0 4px"}}>Step 5 — Monthly PCB</div>
              <div>Annual Tax ÷ 12 = Monthly PCB deduction (rounded to nearest RM).</div>
              <div style={{fontWeight:700,margin:"8px 0 4px"}}>CP38 Instalment</div>
              <div>If LHDN court order is active, add CP38 amount on top of PCB — remit separately.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Selectors: Employee + Month ─────────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
        <Card style={{padding:"16px 18px"}}>
          <div style={{color:C.ts,fontSize:11,fontWeight:700,letterSpacing:"0.5px",marginBottom:10}}>SELECT EMPLOYEE</div>
          <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:220,overflowY:"auto"}}>
            {employees.map(function(e){
              var active = e.id === selEmpId;
              return (
                <div key={e.id} onClick={function(){setSelEmpId(e.id);}}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                    borderRadius:9,cursor:"pointer",border:"1.5px solid "+(active?C.accent+"66":C.border+"55"),
                    background:active?C.accentL:"transparent",transition:"background .12s"}}>
                  <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,
                    background:"linear-gradient(135deg,"+C.accent+","+C.purple+")",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    color:"#fff",fontSize:12,fontWeight:700}}>
                    {(e.name||"?").charAt(0)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:active?C.accent:C.tp,fontWeight:700,fontSize:12,
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</div>
                    <div style={{color:C.ts,fontSize:10}}>{e.dept} · {e.empNo||e.id}</div>
                  </div>
                  {active && <div style={{width:8,height:8,borderRadius:"50%",background:C.accent,flexShrink:0}} />}
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{padding:"16px 18px"}}>
          <div style={{color:C.ts,fontSize:11,fontWeight:700,letterSpacing:"0.5px",marginBottom:6}}>SELECT PAYROLL BATCH</div>
          <div style={{color:C.ts,fontSize:10,marginBottom:10}}>Showing all batches from Payroll module — generate a new draft there to see it here.</div>
          {monthOptions.length === 0 ? (
            <div style={{textAlign:"center",padding:"24px 0",color:C.ts,fontSize:12}}>
              No payroll batches yet. Go to <strong>Payroll</strong> and generate one first.
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:280,overflowY:"auto"}}>
              {monthOptions.map(function(mo){
                var active = mo.value === selMonth;
                var statusColor = mo.status==="Paid"?C.green:mo.status==="Confirmed"?C.accent:mo.status==="Draft"?C.amber:C.tm;
                var statusBg    = mo.status==="Paid"?C.greenL:mo.status==="Confirmed"?C.accentL:mo.status==="Draft"?C.amberL:C.surface;
                return (
                  <div key={mo.value} onClick={function(){setSelMonth(mo.value);}}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
                      padding:"10px 12px",borderRadius:9,cursor:"pointer",
                      border:"1.5px solid "+(active?C.purple+"66":C.border+"55"),
                      background:active?C.purpleL:"transparent",transition:"background .12s"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:active?C.purple:C.tp,fontWeight:700,fontSize:12}}>{mo.label}</div>
                      <div style={{color:C.ts,fontSize:10,marginTop:1}}>{mo.wd} working days</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                      <span style={{background:statusBg,color:statusColor,fontSize:9,fontWeight:700,
                        borderRadius:5,padding:"2px 7px",letterSpacing:"0.3px"}}>
                        {(mo.status||"").toUpperCase()}
                      </span>
                      {active && <div style={{width:8,height:8,borderRadius:"50%",background:C.purple}} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {relief && emp && row && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>

          {/* ── LEFT: Relief breakdown ─────────────────────────────────── */}
          <div>
            {/* Employee header */}
            <Card style={{padding:"14px 16px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{width:44,height:44,borderRadius:"50%",
                  background:"linear-gradient(135deg,"+C.accent+","+C.purple+")",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:"#fff",fontSize:18,fontWeight:800,flexShrink:0}}>
                  {(emp.name||"?").charAt(0)}
                </div>
                <div>
                  <div style={{color:C.tp,fontWeight:800,fontSize:15}}>{emp.name}</div>
                  <div style={{color:C.ts,fontSize:11,marginTop:2}}>{emp.dept} · {emp.empNo||emp.id} · Age {emp.age}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  ["Payroll Month", monthOpt.label],
                  ["Basic Salary",  rmf(emp.basic||0)],
                  ["Marital Status",emp.maritalStatus||"Single"],
                  ["No. of Children",(emp.children||0)+" child"+(emp.children!==1?"ren":"")],
                  ["Tax File No.",   emp.taxNo||"—"],
                  ["LHDN Branch",    emp.taxBranch||"—"],
                ].map(function(pair,i){
                  return (
                    <div key={i} style={{background:C.surface,borderRadius:8,padding:"8px 10px"}}>
                      <div style={{color:C.ts,fontSize:10,fontWeight:700}}>{pair[0].toUpperCase()}</div>
                      <div style={{color:C.tp,fontWeight:600,fontSize:12,marginTop:2}}>{pair[1]}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ── STEP 1: Annual Income ─────────────────────────────── */}
            <Card noPad style={{overflow:"hidden",marginBottom:14}}>
              <div style={{padding:"10px 14px",background:"linear-gradient(90deg,#1E40AF11,transparent)",
                borderBottom:"2px solid "+C.accent+"33",display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:C.accent,
                  color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>1</div>
                <span style={{color:C.accent,fontWeight:800,fontSize:13}}>Annual Income Computation</span>
              </div>
              <div style={{padding:"4px 0"}}>
                <ReliefRow label={"Basic Salary (monthly)"} value={row.basic} />
                <ReliefRow label={"× 12 months"} value={relief.annual} bold={true} sub={false} />
              </div>
            </Card>

            {/* ── STEP 2: Relief deductions ────────────────────────── */}
            <Card noPad style={{overflow:"hidden",marginBottom:14}}>
              <div style={{padding:"10px 14px",background:"linear-gradient(90deg,#05966911,transparent)",
                borderBottom:"2px solid "+C.green+"33",display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:C.green,
                  color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>2</div>
                <span style={{color:C.green,fontWeight:800,fontSize:13}}>Relief Deductions (LHDN YA 2024)</span>
              </div>
              <div style={{padding:"4px 0"}}>
                <SectionLabel label="PERSONAL RELIEFS — AUTO APPLIED (s.46 ITA 1967)" />
                <div style={{padding:"6px 10px",background:"#F0FDF4",borderBottom:"1px solid "+C.border+"22",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <span style={{color:C.tp,fontSize:12}}>Personal Self Relief (s.46(1)(a))</span>
                    <span style={{color:C.tm,fontSize:10,marginLeft:8}}>Fixed annual relief — auto-applied by LHDN, not a monthly claim</span>
                  </div>
                  <span style={{color:C.green,fontWeight:600,fontSize:12}}>{rmf(relief.selfR)}</span>
                </div>
                <ReliefRow label="Self OKU / Disabled Relief (+RM 6,000)" value={relief.selfDis}
                  show={relief.selfDis > 0} badge="OKU" />
                <ReliefRow label={"Self Further Education (max RM 7,000)"} value={relief.selfStudyR}
                  show={relief.selfStudyR > 0} cap="RM 7,000" />

                <SectionLabel label="EPF CONTRIBUTION RELIEF (11% OF BASIC, CAP RM 4,000/YR)" mt />
                <ReliefRow label={"EPF 11% on Basic: RM "+(row.basic||0).toFixed(2)+" × 11% = RM "+relief.epfMonthly.toFixed(2)+"/mth"} sub value={relief.epfAnnual} />
                <ReliefRow label={"EPF Annual Contribution (× 12 months)"} sub value={relief.epfAnnual} />
                <ReliefRow label={"EPF Relief Applied (actual 11% contribution, capped RM 4,000)"} value={relief.epfRelief} bold />
                <ReliefRow label={"Life Insurance Premium (annual)"} sub value={relief.lifeIns} show={relief.lifeIns > 0} />
                <ReliefRow label={"Life Insurance Relief (EPF+Life combined cap RM 7,000)"}
                  value={relief.lifeRelief} show={relief.lifeIns > 0} cap="RM 7,000 combined" />

                <SectionLabel label="INSURANCE (SEPARATE CAPS)" mt />
                <ReliefRow label={"Medical Insurance (max RM 3,000)"} value={relief.medIns}
                  zero={relief.medIns===0} cap="RM 3,000" />

                <SectionLabel label="SPOUSE RELIEFS" mt />
                <ReliefRow label="Spouse Relief (no income)" value={relief.spouseR}
                  zero={relief.spouseR===0} />
                <ReliefRow label="Disabled Spouse (+RM 3,500)" value={relief.spouseDisR}
                  show={relief.spouseDisR > 0} badge="OKU" />

                <SectionLabel label="CHILD RELIEFS" mt />
                {relief.kids.length > 0 ? (
                  relief.kids.map(function(kid, ki){
                    var age2=parseInt(kid.age)||0; var d2=kid.disabled; var l2=kid.studyLevel||"none";
                    var cr = d2?(l2==="university"?16000:8000):age2<=18?2000:(age2<=23&&(l2==="university"||l2==="secondary"))?8000:0;
                    var lvlMap = {none:"Not studying",primary:"Primary",secondary:"Secondary/SPM",university:"University/Diploma"};
                    return (
                      <ReliefRow key={ki}
                        label={(ki+1)+". "+(kid.name||"Child "+(ki+1))+" (age "+age2+", "+lvlMap[l2||"none"]+")"+(d2?" 🔵 OKU":"")}
                        value={cr} sub />
                    );
                  })
                ) : (
                  <ReliefRow label={"Children ("+((parseInt(emp.pcbChildren)||0))+" × RM 2,000)"}
                    value={relief.childRelief} zero={relief.childRelief===0} />
                )}
                {relief.childRelief > 0 && (
                  <ReliefRow label="Total Child Relief" value={relief.childRelief} bold />
                )}

                <SectionLabel label="MEDICAL & HEALTHCARE" mt />
                <ReliefRow label={"Medical — Self / Spouse / Child (max RM 10,000)"}
                  value={relief.medSelf} zero={relief.medSelf===0} cap="RM 10,000" />
                <ReliefRow label={"Medical — Parents (max RM 8,000)"}
                  value={relief.medParents} zero={relief.medParents===0} cap="RM 8,000" />
                <ReliefRow label={"Disability Equipment (max RM 6,000)"}
                  value={relief.disEquip} zero={relief.disEquip===0} cap="RM 6,000" />
                <ReliefRow label={"Breastfeeding Equipment (max RM 1,000)"}
                  value={relief.breastfeed} zero={relief.breastfeed===0} cap="RM 1,000" />

                <SectionLabel label="SAVINGS & LIFESTYLE" mt />
                <ReliefRow label={"Private Retirement Scheme — PRS (max RM 3,000)"}
                  value={relief.prs} zero={relief.prs===0} cap="RM 3,000" />
                <ReliefRow label={"SSP — Skim Simpanan Pendidikan (max RM 3,000)"}
                  value={relief.ssp} zero={relief.ssp===0} cap="RM 3,000" />
                <ReliefRow label={"Childcare / Kindergarten Fees (max RM 3,000)"}
                  value={relief.childcare} zero={relief.childcare===0} cap="RM 3,000" />
                <ReliefRow label={"Sports Equipment & Gym (max RM 1,000)"}
                  value={relief.sport} zero={relief.sport===0} cap="RM 1,000" />
                <ReliefRow label={"Domestic Tourism (max RM 1,000)"}
                  value={relief.domTour} zero={relief.domTour===0} cap="RM 1,000" />
                <ReliefRow label={"EV Charging Facility (max RM 2,500)"}
                  value={relief.evCharge} zero={relief.evCharge===0} cap="RM 2,500" />

                <div style={{padding:"10px 14px",background:C.greenL,borderTop:"2px solid "+C.green+"44",
                  display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                  <span style={{color:C.green,fontWeight:800,fontSize:13}}>Total Relief Applied</span>
                  <span style={{color:C.green,fontWeight:900,fontSize:16}}>{rmf(relief.totalRelief)}</span>
                </div>
              </div>
            </Card>

            {/* ── STEP 3: Chargeable ───────────────────────────────── */}
            <Card noPad style={{overflow:"hidden",marginBottom:14}}>
              <div style={{padding:"10px 14px",background:"linear-gradient(90deg,#D9770611,transparent)",
                borderBottom:"2px solid "+C.amber+"33",display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:C.amber,
                  color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>3</div>
                <span style={{color:C.amber,fontWeight:800,fontSize:13}}>Chargeable Income</span>
              </div>
              <div style={{padding:"14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+C.border+"44"}}>
                  <span style={{color:C.ts,fontSize:12}}>Annual Income</span>
                  <span style={{color:C.tp,fontWeight:600,fontSize:12}}>{rmf(relief.annual)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+C.border+"44"}}>
                  <span style={{color:C.ts,fontSize:12}}>Less: Total Relief</span>
                  <span style={{color:C.red,fontWeight:600,fontSize:12}}>− {rmf(relief.totalRelief)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",
                  borderTop:"2px solid "+C.amber+"44",marginTop:4}}>
                  <span style={{color:C.amber,fontWeight:800,fontSize:14}}>Chargeable Income</span>
                  <span style={{color:C.amber,fontWeight:900,fontSize:18}}>{rmf(relief.chargeable)}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* ── RIGHT: Tax brackets + Final summary ───────────────────── */}
          <div>
            {/* ── STEP 4: Tax brackets ─────────────────────────────── */}
            <Card noPad style={{overflow:"hidden",marginBottom:14}}>
              <div style={{padding:"10px 14px",background:"linear-gradient(90deg,#7C3AED11,transparent)",
                borderBottom:"2px solid "+C.purple+"33",display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:C.purple,
                  color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>4</div>
                <span style={{color:C.purple,fontWeight:800,fontSize:13}}>Progressive Tax Bracket Calculation</span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{background:C.surface}}>
                      {["Income Band","Taxable","Rate","Tax"].map(function(h,hi){
                        return <th key={h} style={{padding:"8px 10px",textAlign:hi>=2?"right":"left",
                          color:C.ts,fontWeight:700,borderBottom:"2px solid "+C.border,fontSize:10}}>{h}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {relief.bracketRows.map(function(br,i){
                      return (
                        <tr key={i} style={{
                          background:br.active?(i%2===0?"#F5F3FF":"#EDE9FE"):(i%2===0?"transparent":"#FAFAFA"),
                          borderBottom:"1px solid "+C.border+"33",
                          opacity:br.active?1:0.45}}>
                          <td style={{padding:"8px 10px",color:br.active?C.tp:C.tm,fontWeight:br.active?600:400}}>{br.label}</td>
                          <td style={{padding:"8px 10px",color:br.active?C.tp:C.tm,textAlign:"right"}}>
                            {br.active ? rmf(br.taxable) : "—"}
                          </td>
                          <td style={{padding:"8px 10px",textAlign:"right"}}>
                            <span style={{background:br.active?C.purpleL:"transparent",color:br.active?C.purple:C.tm,
                              borderRadius:5,padding:"2px 7px",fontWeight:br.active?700:400}}>
                              {pct(br.rate)}
                            </span>
                          </td>
                          <td style={{padding:"8px 10px",color:br.active?C.purple:C.tm,fontWeight:br.active?700:400,textAlign:"right"}}>
                            {br.active ? rmf(br.tax) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{background:C.purpleL,borderTop:"2px solid "+C.purple+"44"}}>
                      <td colSpan={3} style={{padding:"10px 10px",color:C.purple,fontWeight:800,fontSize:12}}>
                        Total Annual Tax
                      </td>
                      <td style={{padding:"10px 10px",color:C.purple,fontWeight:900,fontSize:15,textAlign:"right"}}>
                        {rmf(relief.annualTax)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {/* ── STEP 5: Monthly PCB ──────────────────────────────── */}
            <Card noPad style={{overflow:"hidden",marginBottom:14}}>
              <div style={{padding:"10px 14px",background:"linear-gradient(90deg,#E5374A11,transparent)",
                borderBottom:"2px solid "+C.red+"33",display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:C.red,
                  color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>5</div>
                <span style={{color:C.red,fontWeight:800,fontSize:13}}>Monthly PCB / MTD Deduction</span>
              </div>
              <div style={{padding:"14px"}}>
                {[
                  ["Annual Tax (from Step 4)", rmf(relief.annualTax), C.tp, false],
                  ["÷ 12 months (equal monthly instalment)", "= "+rmf(relief.monthlyPCB), C.ts, false],
                  ["Rounded to nearest RM (LHDN rule)", "", C.ts, false],
                ].map(function(r,i){
                  return (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+C.border+"44"}}>
                      <span style={{color:C.ts,fontSize:12}}>{r[0]}</span>
                      <span style={{color:r[2],fontWeight:600,fontSize:12}}>{r[1]}</span>
                    </div>
                  );
                })}
                <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderTop:"2px solid "+C.red+"33",marginTop:4}}>
                  <span style={{color:C.red,fontWeight:800,fontSize:14}}>Standard Monthly PCB</span>
                  <span style={{color:C.red,fontWeight:900,fontSize:22}}>{rmf(relief.monthlyPCB)}</span>
                </div>
                {relief.cp38Active && (
                  <div style={{background:C.amberL,border:"1.5px solid "+C.amber+"66",borderRadius:10,padding:"12px 14px",marginTop:8}}>
                    <div style={{color:C.amber,fontWeight:700,fontSize:12,marginBottom:8}}>⚡ CP38 — LHDN Court Order Active This Month</div>
                    {[
                      ["Normal PCB (MTD)", rmf(relief.monthlyPCB)],
                      ["CP38 Monthly Instalment", "+ "+rmf(relief.cp38Amt)],
                    ].map(function(r,i){
                      return (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+C.amber+"33"}}>
                          <span style={{color:C.ts,fontSize:12}}>{r[0]}</span>
                          <span style={{color:C.amber,fontWeight:700}}>{r[1]}</span>
                        </div>
                      );
                    })}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:4}}>
                      <span style={{color:C.amber,fontWeight:800,fontSize:13}}>Total Tax Deduction</span>
                      <span style={{color:C.amber,fontWeight:900,fontSize:16}}>{rmf(relief.totalDeductMonthly)}</span>
                    </div>
                    <div style={{color:"#92400E",fontSize:10,marginTop:4,fontStyle:"italic"}}>Remit CP38 separately via MyTax — do NOT combine with PCB/CP39.</div>
                  </div>
                )}
              </div>
            </Card>

            {/* ── STEP 6: Accumulated PCB Reconciliation ───────────── */}
            <Card noPad style={{overflow:"hidden",marginBottom:14}}>
              <div style={{padding:"10px 14px",background:"linear-gradient(90deg,#0EA5C911,transparent)",
                borderBottom:"2px solid #0EA5C944",display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:"#0EA5C9",
                  color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>6</div>
                <span style={{color:"#0EA5C9",fontWeight:800,fontSize:13}}>Accumulated PCB Reconciliation — YA {relief.taxYear}</span>
              </div>
              <div style={{padding:0}}>
                {/* Prior months table */}
                {relief.accumRows.length > 0 ? (
                  <div>
                    <div style={{padding:"6px 10px",background:C.surface,borderBottom:"1px solid "+C.border,
                      color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"0.5px"}}>
                      PCB DEDUCTED IN PRIOR MONTHS ({relief.taxYear})
                    </div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead>
                        <tr style={{background:C.surface}}>
                          {["Month","Status","PCB Deducted"].map(function(h,hi){
                            return <th key={h} style={{padding:"6px 10px",textAlign:hi===2?"right":"left",
                              color:C.ts,fontWeight:700,borderBottom:"1px solid "+C.border,fontSize:10}}>{h}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {relief.accumRows.map(function(ar,i){
                          var sc = ar.status==="Paid"?C.green:ar.status==="Confirmed"?C.accent:C.amber;
                          var sb = ar.status==="Paid"?C.greenL:ar.status==="Confirmed"?C.accentL:C.amberL;
                          return (
                            <tr key={i} style={{borderBottom:"1px solid "+C.border+"33",background:i%2===0?"transparent":"#F8FAFF"}}>
                              <td style={{padding:"7px 10px",color:C.tp,fontWeight:600,fontSize:12}}>{ar.period}</td>
                              <td style={{padding:"7px 10px"}}>
                                <span style={{background:sb,color:sc,fontSize:9,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>
                                  {(ar.status||"").toUpperCase()}
                                </span>
                              </td>
                              <td style={{padding:"7px 10px",textAlign:"right",color:C.purple,fontWeight:700}}>{rmf(ar.pcb)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{background:C.purpleL,borderTop:"2px solid "+C.purple+"33"}}>
                          <td colSpan={2} style={{padding:"8px 10px",color:C.purple,fontWeight:800,fontSize:11}}>
                            Total PCB Paid / Deducted ({relief.monthsElapsed} month{relief.monthsElapsed!==1?"s":""})
                          </td>
                          <td style={{padding:"8px 10px",textAlign:"right",color:C.purple,fontWeight:900,fontSize:13}}>
                            {rmf(relief.pcbAccumulated)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div style={{padding:"12px 14px",background:C.accentL,color:C.accent,fontSize:11,fontWeight:600}}>
                    No prior payroll batches found for YA {relief.taxYear} before {monthOpt.label}. This is the first month of the tax year.
                  </div>
                )}

                {/* Reconciliation arithmetic */}
                <div style={{padding:"14px"}}>
                  <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:"0.5px",marginBottom:10}}>
                    YEAR-TO-DATE RECONCILIATION
                  </div>
                  {[
                    ["Total Annual Tax Payable (YA "+relief.taxYear+")", rmf(relief.annualTax), C.tp, false],
                    ["Less: PCB Already Deducted ("+relief.monthsElapsed+" month"+(relief.monthsElapsed!==1?"s":"")+")", "– "+rmf(relief.pcbAccumulated), C.red, false],
                    ["= Remaining Tax to Collect", rmf(relief.taxRemaining), C.amber, true],
                    ["Remaining Months (incl. this month)", relief.monthsRemaining+" month"+(relief.monthsRemaining!==1?"s":""), C.ts, false],
                    ["Adjusted Monthly PCB ("+relief.taxYear+" reconciled)", rmf(relief.adjustedMonthlyPCB), C.green, true],
                  ].map(function(r,i){
                    return (
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                        padding:r[3]?"10px 0":"7px 0",
                        borderBottom:i<4?"1px solid "+C.border+"44":"none",
                        borderTop:r[3]&&i===2?"2px solid "+C.amber+"44":"none",
                        borderTopWidth:r[3]&&i===4?"2px":"",
                        borderTopColor:r[3]&&i===4?C.green+"44":""}}>
                        <span style={{color:C.ts,fontSize:12,fontWeight:r[3]?700:400}}>{r[0]}</span>
                        <span style={{color:r[2],fontWeight:r[3]?800:600,fontSize:r[3]?15:12}}>{r[1]}</span>
                      </div>
                    );
                  })}
                  {Math.abs(relief.adjustedMonthlyPCB - relief.monthlyPCB) > 0 && (
                    <div style={{marginTop:10,padding:"8px 12px",background:relief.adjustedMonthlyPCB>relief.monthlyPCB?C.amberL:C.greenL,
                      borderRadius:8,fontSize:11,color:relief.adjustedMonthlyPCB>relief.monthlyPCB?C.amber:C.green,fontWeight:600}}>
                      {relief.adjustedMonthlyPCB > relief.monthlyPCB
                        ? "⚠ Adjusted PCB is higher than standard — under-deduction in prior months. HR should use adjusted amount to catch up."
                        : "✓ Adjusted PCB is lower than standard — prior months had slight over-deduction. Balance will reduce this month's deduction."}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* ── Final Summary Card ───────────────────────────────── */}
            <Card style={{background:"linear-gradient(135deg,#1E1B4B,#312E81)",padding:"20px 22px",marginBottom:14}}>
              <div style={{color:"#A5B4FC",fontSize:11,fontWeight:700,letterSpacing:"0.6px",marginBottom:14}}>
                PCB AUDIT SUMMARY — {(emp.name||"").toUpperCase()} · {(monthOpt.label||"").toUpperCase()}
              </div>
              {[
                ["Annual Gross Income (Basic × 12)",      rmf(relief.annual),             "#fff"],
                ["Less: Total Tax Relief",                 "– "+rmf(relief.totalRelief),   "#6EE7B7"],
                ["= Chargeable Income",                    rmf(relief.chargeable),          "#FCD34D"],
                ["Annual Tax Payable",                     rmf(relief.annualTax),           "#FCA5A5"],
                ["PCB Accumulated (prior months YA "+relief.taxYear+")", rmf(relief.pcbAccumulated), "#93C5FD"],
                ["Remaining Tax to Collect",               rmf(relief.taxRemaining),        "#FDE68A"],
                ["Standard Monthly PCB (÷12)",             rmf(relief.monthlyPCB),          "#F9A8D4"],
                ["Reconciled Monthly PCB (this month)",    rmf(relief.adjustedMonthlyPCB),  "#86EFAC"],
              ].map(function(r,i){
                var isBig = i >= 6;
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",
                    padding:isBig?"10px 0":"7px 0",
                    borderBottom:i<7?"1px solid rgba(255,255,255,.1)":"none",
                    borderTop:i===6?"1px solid rgba(255,255,255,.2)":"none"}}>
                    <span style={{color:"rgba(255,255,255,.7)",fontSize:isBig?13:12}}>{r[0]}</span>
                    <span style={{color:r[2],fontWeight:700,fontSize:isBig?16:12}}>{r[1]}</span>
                  </div>
                );
              })}
              {relief.cp38Active && (
                <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",
                  borderTop:"1px solid rgba(255,200,0,.3)",marginTop:4}}>
                  <span style={{color:"#FDE68A",fontSize:12}}>+ CP38 Instalment (remit separately)</span>
                  <span style={{color:"#FDE68A",fontWeight:700,fontSize:14}}>{rmf(relief.cp38Amt)}</span>
                </div>
              )}
              <div style={{marginTop:14,padding:"12px 14px",background:"rgba(255,255,255,.1)",borderRadius:10,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{color:"rgba(255,255,255,.6)",fontSize:10,fontWeight:700}}>TOTAL DEDUCT THIS MONTH</div>
                  <div style={{color:"rgba(255,255,255,.5)",fontSize:10,marginTop:2}}>Reconciled PCB{relief.cp38Active?" + CP38":""}</div>
                </div>
                <div style={{color:"#fff",fontWeight:900,fontSize:26}}>{rmf(relief.adjustedTotal)}</div>
              </div>
            </Card>

            {/* ── Effective Rate indicator ─────────────────────────── */}
            <Card style={{padding:"16px 18px"}}>
              <div style={{color:C.ts,fontSize:11,fontWeight:700,letterSpacing:"0.5px",marginBottom:12}}>EFFECTIVE TAX RATE — YA {relief.taxYear}</div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{height:10,background:C.surface,borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:"linear-gradient(90deg,"+C.green+","+C.purple+")",
                      width:Math.min(100, relief.annual>0?(relief.annualTax/relief.annual*100):0)+"%",
                      borderRadius:10,transition:"width .4s ease"}} />
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    <span style={{color:C.tm,fontSize:9}}>0%</span>
                    <span style={{color:C.tm,fontSize:9}}>28%</span>
                  </div>
                </div>
                <div style={{color:C.purple,fontWeight:900,fontSize:22,minWidth:64,textAlign:"right"}}>
                  {relief.annual>0?(relief.annualTax/relief.annual*100).toFixed(1)+"%":"0%"}
                </div>
              </div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <div style={{background:C.purpleL,borderRadius:8,padding:"8px 12px",flex:1}}>
                  <div style={{color:C.ts,fontSize:10,fontWeight:700}}>MARGINAL RATE</div>
                  <div style={{color:C.purple,fontWeight:900,fontSize:18,marginTop:2}}>
                    {(function(){
                      var ci=relief.chargeable;
                      if(ci<=5000)return"0%"; if(ci<=20000)return"1%"; if(ci<=35000)return"3%";
                      if(ci<=50000)return"6%"; if(ci<=70000)return"11%"; if(ci<=100000)return"19%";
                      if(ci<=250000)return"25%"; return"28%";
                    })()}
                  </div>
                  <div style={{color:C.tm,fontSize:9,marginTop:2}}>on next RM earned</div>
                </div>
                <div style={{background:C.accentL,borderRadius:8,padding:"8px 12px",flex:1}}>
                  <div style={{color:C.ts,fontSize:10,fontWeight:700}}>YTD PCB PAID</div>
                  <div style={{color:C.accent,fontWeight:900,fontSize:18,marginTop:2}}>{rmf(relief.pcbAccumulated)}</div>
                  <div style={{color:C.tm,fontSize:9,marginTop:2}}>{relief.monthsElapsed} month{relief.monthsElapsed!==1?"s":""} deducted</div>
                </div>
                <div style={{background:C.greenL,borderRadius:8,padding:"8px 12px",flex:1}}>
                  <div style={{color:C.ts,fontSize:10,fontWeight:700}}>BALANCE TO COLLECT</div>
                  <div style={{color:C.green,fontWeight:900,fontSize:18,marginTop:2}}>{rmf(relief.taxRemaining)}</div>
                  <div style={{color:C.tm,fontSize:9,marginTop:2}}>over {relief.monthsRemaining} month{relief.monthsRemaining!==1?"s":""}</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function StatutoryModule(props) {
  var employees    = props.employees    || [];
  var payrollConfig= props.payrollConfig|| INIT_PAYROLL_CONFIG;
  var gSched       = props.sched        || {};
  var gWh          = props.wh           || {};
  var gUnified     = props.unifiedShift || {};
  var gSchedMode   = props.schedMode    || "off";
  var batches      = props.batches      || PAYROLL_BATCHES_INIT;
  var [activeTab, setActiveTab] = useState("epf");
  var tabs = [["epf","EPF (KWSP)"],["socso","SOCSO"],["eis","EIS"],["pcb","PCB / MTD"],["hrdf","HRDF"]];

  return (
    <div>
      <SectionHead title="Statutory Compliance" sub="EPF, SOCSO, EIS, PCB/MTD, HRDF - Malaysia official rates with calculators" />
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {tabs.map(function(t) {
          return (
            <button key={t[0]} onClick={function(){setActiveTab(t[0]);}} style={{
              background:activeTab===t[0]?C.accentL:"transparent",
              color:activeTab===t[0]?C.accent:C.ts,
              border:"1.5px solid "+(activeTab===t[0]?C.accent+"66":C.border),
              borderRadius:8,padding:"7px 18px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            }}>{t[1]}</button>          );
        })}
      </div>

      {activeTab === "epf" && (
        <div style={S.g2m}>
          <RatesCard title="EPF Contribution Rates (KWSP)" valueColor={C.green} rows={[
            ["Employee (EE) - Age below 55","11% of basic salary"],
            ["Employer (ER) - Wage up to RM 5,000","13% of basic salary"],
            ["Employer (ER) - Wage above RM 5,000","12% of basic salary"],
            ["Employee - Age 55 to 59","5.5% of basic salary"],
            ["Employer - Age 55 to 59","6.5% of basic salary"],
            ["Employee - Age 60 and above","0% (fully exempt)"],
            ["Employer - Age 60 and above","4% of basic salary"],
            ["Contribution rounds to","Nearest RM (no sen)"],
            ["Submission portal","i-Akaun Majikan (KWSP)"],
            ["Deadline","15th of following month"],
          ]} />
          <Card>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <div style={{width:32,height:32,borderRadius:8,background:C.greenL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🧮</div>
              <div style={S.tp14b}>EPF Calculator</div>
            </div>
            <div style={{color:C.ts,fontSize:11,marginBottom:14,padding:"8px 12px",background:C.surface,borderRadius:8}}>
              Enter wage and age, then click Calculate or press <strong>Enter</strong> in any field.
            </div>
            <EpfCalc />
          </Card>
        </div>
      )}

      {activeTab === "socso" && (
        <div style={S.g2m}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Card>
              <div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:10,paddingBottom:8,borderBottom:"2px solid "+C.accentL}}>Category 1 - Age below 60 (Employment Injury + Invalidity)</div>
              {[["Employee (EE)","~0.5% of insurable wage (per schedule)"],["Employer (ER)","~1.75% of insurable wage (per schedule)"],["Wage Ceiling","RM 6,000 per month"],["Submission","EzHASIL portal - Borang 8A"],["Deadline","15th of following month"]].map(function(r,i){
                return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<4?"1px solid "+C.border+"33":"none"}}><span style={S.ts12}>{r[0]}</span><span style={{color:C.accent,fontWeight:600,fontSize:12}}>{r[1]}</span></div>;
              })}
            </Card>
            <Card>
              <div style={{color:C.amber,fontWeight:700,fontSize:13,marginBottom:10,paddingBottom:8,borderBottom:"2px solid "+C.amberL}}>Category 2 - Age 60 and above (Employment Injury only)</div>
              {[["Employee (EE)","0% (fully exempt)"],["Employer (ER)","~1.25% of insurable wage"],["Wage Ceiling","RM 6,000 per month"],["Note","EE no longer contributes at age 60+"]].map(function(r,i){
                return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<3?"1px solid "+C.border+"33":"none"}}><span style={S.ts12}>{r[0]}</span><span style={{color:C.amber,fontWeight:600,fontSize:12}}>{r[1]}</span></div>;
              })}
            </Card>
          </div>
          <Card>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <div style={{width:32,height:32,borderRadius:8,background:C.accentL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🧮</div>
              <div style={S.tp14b}>SOCSO Calculator</div>
            </div>
            <div style={{color:C.ts,fontSize:11,marginBottom:14,padding:"8px 12px",background:C.surface,borderRadius:8}}>
              Uses official PERKESO First Schedule table. Press <strong>Enter</strong> or click Calculate.
            </div>
            <SocsoCalc />
          </Card>
        </div>
      )}

      {activeTab === "eis" && (
        <div style={S.g2m}>
          <RatesCard title="EIS - Employment Insurance System (Akta 800)" valueColor={C.purple} rows={[
            ["Employee (EE)","0.2% of insurable wage"],
            ["Employer (ER)","0.2% of insurable wage (equal to EE)"],
            ["Wage Ceiling","RM 6,000 per month"],
            ["Age 60 and above","Fully exempt - EE = ER = 0"],
            ["Submission portal","SOCSO Portal (perkeso.gov.my)"],
            ["Form","Borang IS"],
            ["Deadline","15th of following month"],
            ["Benefits","Job loss income replacement up to 6 months"],
          ]} />
          <Card>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <div style={{width:32,height:32,borderRadius:8,background:C.purpleL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🧮</div>
              <div style={S.tp14b}>EIS Calculator</div>
            </div>
            <div style={{color:C.ts,fontSize:11,marginBottom:14,padding:"8px 12px",background:C.surface,borderRadius:8}}>
              EE and ER are equal at 0.2% each. Age 60+ is automatically exempt. Press <strong>Enter</strong> or click Calculate.
            </div>
            <EisCalc />
          </Card>
        </div>
      )}

      {activeTab === "pcb" && (
        <PcbVerificationTool employees={employees} payrollConfig={payrollConfig} gSched={gSched} gWh={gWh} gUnified={gUnified} gSchedMode={gSchedMode} batches={batches} />
      )}

      {activeTab === "hrdf" && (
        <div style={S.g2m}>
          <RatesCard title="HRDF - Human Resources Development Fund (HRD Corp)" valueColor={C.amber} rows={[
            ["Rate","1% of basic salary (employer only)"],
            ["Mandatory","Companies with 10 or more employees"],
            ["Optional","Companies with 5 to 9 employees"],
            ["Exempt","Less than 5 employees"],
            ["Portal","HRD Corp e-TRiS portal"],
            ["Deadline","Last day of following month"],
            ["Benefit","Training grants and claimable for approved courses"],
          ]} />
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:16}}>HRDF Quick Reference</div>
            <div style={{background:C.amberL,borderRadius:10,padding:"14px 16px",marginBottom:14}}>
              <div style={{color:C.amber,fontWeight:700,fontSize:13,marginBottom:8}}>Formula</div>
              <div style={{color:C.tp,fontSize:13,fontWeight:600}}>HRDF = Basic Salary x 1%</div>
              <div style={{color:C.ts,fontSize:12,marginTop:4}}>Employer contribution only. No employee deduction.</div>
            </div>
            {[["RM 3,000 basic","RM 30.00/month"],["RM 5,000 basic","RM 50.00/month"],["RM 7,500 basic","RM 75.00/month"],["RM 10,000 basic","RM 100.00/month"]].map(function(r,i){
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<3?"1px solid "+C.border+"44":"none"}}>
                  <span style={S.ts12}>{r[0]}</span>
                  <span style={{color:C.amber,fontWeight:700}}>{r[1]}</span>
                </div>              );
            })}
          </Card>
        </div>
      )}
    </div>  );
}

// -- LEAVE MODULE
var INIT_LEAVE_DATA = [
  {id:"L000",empId:"E002",empNo:"EMP002",name:"Lim Wei Ting",   dept:"Finance",  type:"Annual Leave",    typeColor:"#0EA5C9", from:"2025-06-23",to:"2025-06-25",days:3, status:"Pending",  note:"Family vacation",  docName:"",            submittedOn:"2025-06-12"},
  {id:"L001",empId:"E001",empNo:"EMP001",name:"Ahmad Farid",    dept:"IT",       type:"Annual Leave",    typeColor:"#0EA5C9", from:"2025-06-10",to:"2025-06-12",days:3, status:"Approved", note:"Family trip",      docName:"",            submittedOn:"2025-06-01"},
  {id:"L002",empId:"E002",empNo:"EMP002",name:"Lim Wei Ting",   dept:"Finance",  type:"Sick Leave",      typeColor:"#059669", from:"2025-06-08",to:"2025-06-08",days:1, status:"Approved", note:"Fever",            docName:"MC_0608.pdf", submittedOn:"2025-06-08"},
  {id:"L003",empId:"E003",empNo:"EMP003",name:"Rajesh Kumar",   dept:"Sales",    type:"Emergency Leave", typeColor:"#DC2626", from:"2025-06-15",to:"2025-06-15",days:1, status:"Pending",  note:"Family emergency", docName:"",            submittedOn:"2025-06-10"},
  {id:"L004",empId:"E004",empNo:"EMP004",name:"Siti Nurul Ain", dept:"HR",       type:"Maternity Leave", typeColor:"#EC4899", from:"2025-07-01",to:"2025-09-06",days:98,status:"Approved", note:"",                 docName:"MC_Mat.pdf",  submittedOn:"2025-06-20"},
  {id:"L005",empId:"E005",empNo:"EMP005",name:"Tan Mei Ling",   dept:"IT",       type:"Annual Leave",    typeColor:"#0EA5C9", from:"2025-06-18",to:"2025-06-20",days:3, status:"Pending",  note:"Family holiday",   docName:"",            submittedOn:"2025-06-11"},
  {id:"L006",empId:"E001",empNo:"EMP001",name:"Ahmad Farid",    dept:"IT",       type:"Annual Leave",    typeColor:"#0EA5C9", from:"2025-05-26",to:"2025-05-28",days:3, status:"Approved", note:"",                 docName:"",            submittedOn:"2025-05-15"},
  {id:"L007",empId:"E002",empNo:"EMP002",name:"Lim Wei Ting",   dept:"Finance",  type:"Sick Leave",      typeColor:"#059669", from:"2025-05-15",to:"2025-05-15",days:1, status:"Approved", note:"Throat infection",  docName:"MC_0515.pdf", submittedOn:"2025-05-15"},
  {id:"L008",empId:"E003",empNo:"EMP003",name:"Rajesh Kumar",   dept:"Sales",    type:"Annual Leave",    typeColor:"#0EA5C9", from:"2025-07-14",to:"2025-07-18",days:5, status:"Approved", note:"Vacation",         docName:"",            submittedOn:"2025-07-01"},
];

function LeaveModule(props) {
  var employees = props.employees || [];
  var leaveConfig = props.leaveConfig || {leaveTypes:[], publicHolidays:[], entitlements:[], policy:{}};
  var payrollConfig = props.payrollConfig || INIT_PAYROLL_CONFIG;

  var [leaves, setLeaves] = props.leaves && props.setLeaves ? [props.leaves, props.setLeaves] : useState(INIT_LEAVE_DATA);
  var _tab    = useState("calendar");      var tab    = _tab[0];    var setTab    = _tab[1];
  var _yr     = useState(2025);            var year   = _yr[0];     var setYear   = _yr[1];
  var _mo     = useState(5);               var month  = _mo[0];     var setMonth  = _mo[1];
  var _filter = useState("all");           var filter = _filter[0]; var setFilter = _filter[1];
  var _selLeave = useState(null);          var selLeave = _selLeave[0]; var setSelLeave = _selLeave[1];

  // Leave type colors (fallback if no leaveConfig)
  var TYPE_COLORS = {
    "Annual Leave":"#0EA5C9","Sick Leave":"#059669","Emergency Leave":"#DC2626",
    "Maternity Leave":"#EC4899","Paternity Leave":"#3B82F6","Hospitalisation Leave":"#7C3AED",
    "Unpaid Leave":"#94A3B8","Replacement Leave":"#D97706",
  };

  var getTypeColor = function(typeName) {
    var lt = (leaveConfig.leaveTypes||[]).find(function(t){return t.name===typeName;});
    if (lt) return lt.color;
    return TYPE_COLORS[typeName] || C.accent;
  };

  var calGrid = buildCalendar(year, month);
  var daysInMonth = new Date(year, month+1, 0).getDate();

  var prevMonth = function() {
    if (month===0){setMonth(11);setYear(function(y){return y-1;});}
    else setMonth(function(m){return m-1;});
  };
  var nextMonth = function() {
    if (month===11){setMonth(0);setYear(function(y){return y+1;});}
    else setMonth(function(m){return m+1;});
  };

  // Get leaves that overlap a specific date
  var getLeavesOnDate = function(day) {
    var dateStr = year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
    return leaves.filter(function(l) {
      if (l.status === "Rejected") return false;
      if (filter !== "all" && l.status !== filter) return false;
      return l.from <= dateStr && l.to >= dateStr;
    });
  };

  // Get public holidays on date
  var getPHonDate = function(day) {
    var dateStr = year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
    return (leaveConfig.publicHolidays||[]).filter(function(h){return h.date===dateStr;});
  };

  var approve = function(id) {
    setLeaves(function(prev){return prev.map(function(l){return l.id===id?Object.assign({},l,{status:"Approved"}):l;});});
  };
  var reject = function(id) {
    setLeaves(function(prev){return prev.map(function(l){return l.id===id?Object.assign({},l,{status:"Rejected"}):l;});});
  };

  // Leaves in the current month view
  var leavesThisMonth = leaves.filter(function(l) {
    var mStr = year+"-"+String(month+1).padStart(2,"0");
    return (l.from.slice(0,7)===mStr || l.to.slice(0,7)===mStr) && l.status!=="Rejected";
  });
  var pending = leaves.filter(function(l){return l.status==="Pending";});

  // Count employees on leave today
  var todayStr = (function(){var t=new Date(); return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");})();
  var onLeaveToday = leaves.filter(function(l){return l.status==="Approved"&&l.from<=todayStr&&l.to>=todayStr;}).length;

  var TABS = [["calendar","Team Calendar"],["applications","Applications"],["approval","Approve Leave"],["summary","Summary"]];

  return (
    <div>
      <SectionHead title="Leave Management" sub={MONTHS_NAMES[month]+" "+year+" - Team leave overview"} />

      {/* Detail drawer */}
      {selLeave && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,.45)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <Card style={{width:420,padding:28}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{color:C.tp,fontWeight:800,fontSize:16}}>{selLeave.name}</div>
                <div style={{color:C.ts,fontSize:12,marginTop:2}}>{selLeave.dept}</div>
              </div>
              <button onClick={function(){setSelLeave(null);}} style={{background:"none",border:"none",color:C.ts,fontSize:20,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>x</button>
            </div>
            <div style={{background:getTypeColor(selLeave.type)+"18",border:"1.5px solid "+getTypeColor(selLeave.type)+"44",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
              <div style={{color:getTypeColor(selLeave.type),fontWeight:800,fontSize:15}}>{selLeave.type}</div>
              <div style={{color:C.tp,fontSize:13,marginTop:4}}>{selLeave.from} to {selLeave.to}</div>
              <div style={{color:C.ts,fontSize:12,marginTop:2}}>{selLeave.days} day{selLeave.days>1?"s":""}</div>
            </div>
            {selLeave.note && <div style={{color:C.ts,fontSize:12,marginBottom:12}}>Note: {selLeave.note}</div>}
            <div style={S.mb16}><StatusChip s={selLeave.status} /></div>
            {selLeave.status==="Pending" && (
              <div style={S.rowG10}>
                <Btn c={C.green} onClick={function(){approve(selLeave.id);setSelLeave(null);}}>Approve</Btn>
                <Btn c={C.red}   onClick={function(){reject(selLeave.id); setSelLeave(null);}}>Reject</Btn>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Top stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
        {[
          ["On Leave Today",  onLeaveToday,              "#DC2626"],
          ["Pending Approval",pending.length,             C.amber],
          ["This Month",      leavesThisMonth.length,     C.accent],
          ["Approved Total",  leaves.filter(function(l){return l.status==="Approved";}).length, C.green],
        ].map(function(item){
          return (
            <Card key={item[0]} style={{textAlign:"center",padding:"12px 10px",borderTop:"3px solid "+item[2]}}>
              <div style={{color:item[2],fontWeight:900,fontSize:26}}>{item[1]}</div>
              <div style={{color:C.ts,fontSize:10,fontWeight:600,marginTop:3}}>{item[0]}</div>
            </Card>          );
        })}
      </div>

      {/* Controls */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        {/* Month nav */}
        <div style={{display:"flex",alignItems:"center",gap:6,background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"5px 8px"}}>
          <button onClick={prevMonth} style={{background:"none",border:"none",color:C.accent,fontSize:15,cursor:"pointer",fontFamily:"inherit",padding:"0 4px"}}>{"<"}</button>
          <select value={month} onChange={function(e){setMonth(parseInt(e.target.value));}} style={Object.assign({},selectStyle,{marginBottom:0,width:100,fontSize:11,padding:"3px 6px"})}>
            {MONTHS_NAMES.map(function(m,i){return <option key={i} value={i}>{m}</option>;})}
          </select>
          <select value={year} onChange={function(e){setYear(parseInt(e.target.value));}} style={Object.assign({},selectStyle,{marginBottom:0,width:68,fontSize:11,padding:"3px 6px"})}>
            {[2024,2025,2026].map(function(y){return <option key={y} value={y}>{y}</option>;})}
          </select>
          <button onClick={nextMonth} style={{background:"none",border:"none",color:C.accent,fontSize:15,cursor:"pointer",fontFamily:"inherit",padding:"0 4px"}}>{">"}</button>
        </div>

        {/* Status filter */}
        <div style={{display:"flex",gap:5}}>
          {[["all","All"],["Approved","Approved"],["Pending","Pending"]].map(function(f){
            var active = filter===f[0];
            return <button key={f[0]} onClick={function(){setFilter(f[0]);}} style={{background:active?C.accentL:"transparent",color:active?C.accent:C.ts,border:"1.5px solid "+(active?C.accent+"66":C.border),borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{f[1]}</button>;
          })}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          {TABS.map(function(t){
            var active = tab===t[0];
            return <button key={t[0]} onClick={function(){setTab(t[0]);}} style={{background:active?C.accentL:"transparent",color:active?C.accent:C.ts,border:"1.5px solid "+(active?C.accent+"66":C.border),borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t[1]}</button>;
          })}
        </div>
      </div>

      {/* -- TEAM CALENDAR TAB */}
      {tab === "calendar" && (
        <Card noPad style={{overflow:"hidden"}}>
          {/* Calendar header */}
          <div style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <button onClick={prevMonth} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:7,color:"#fff",fontSize:13,cursor:"pointer",padding:"4px 12px",fontFamily:"inherit"}}>{"< Prev"}</button>
            <span style={{color:"#fff",fontWeight:800,fontSize:16}}>{MONTHS_NAMES[month]} {year}</span>
            <button onClick={nextMonth} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:7,color:"#fff",fontSize:13,cursor:"pointer",padding:"4px 12px",fontFamily:"inherit"}}>{"Next >"}</button>
          </div>

          {/* Day headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:C.surface,borderBottom:"1px solid "+C.border}}>
            {DAYS_SHORT.map(function(d){
              var isWknd = d==="Sat"||d==="Sun";
              return <div key={d} style={{textAlign:"center",padding:"8px 4px",color:isWknd?C.amber:C.ts,fontWeight:700,fontSize:11}}>{d}</div>;
            })}
          </div>

          {/* Calendar grid */}
          <div style={{padding:8}}>
            {calGrid.map(function(week,wi){
              return (
                <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
                  {week.map(function(day,di){
                    if (!day) return <div key={di} style={{minHeight:100}} />;
                    var today2 = new Date(); var isToday = day===today2.getDate()&&month===today2.getMonth()&&year===today2.getFullYear();
                    var isWknd = di===5||di===6;
                    var dayLeaves = getLeavesOnDate(day);
                    var dayPHs = getPHonDate(day);
                    var MAX_SHOW = 3;
                    return (
                      <div key={di} style={{minHeight:100,border:"1.5px solid "+(isToday?C.accent:dayPHs.length?"#F59E0B44":C.border+"55"),borderRadius:8,padding:"4px 5px",background:isToday?C.accentL:isWknd?"#FFFBF0":dayPHs.length?"#FFFBEB":"#fff",overflow:"hidden"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                          <span style={{fontWeight:isToday?800:600,fontSize:11,color:isToday?C.accent:isWknd?C.amber:C.tp,background:isToday?C.accent+"22":"transparent",borderRadius:"50%",width:20,height:20,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{day}</span>
                          {dayLeaves.length>0 && <span style={{color:C.accent,fontSize:9,fontWeight:700}}>{dayLeaves.length} off</span>}
                        </div>
                        {/* Public holidays */}
                        {dayPHs.map(function(ph){
                          return (
                            <div key={ph.id} style={{background:"#F59E0B",borderRadius:3,padding:"2px 4px",marginBottom:2}}>
                              <div style={{color:"#fff",fontSize:8,fontWeight:700,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ph.name}</div>
                            </div>                          );
                        })}
                        {/* Leave entries */}
                        {dayLeaves.slice(0,MAX_SHOW).map(function(l){
                          var clr = getTypeColor(l.type);
                          var isPending = l.status==="Pending";
                          return (
                            <div key={l.id} onClick={function(){setSelLeave(l);}} title={l.name+" - "+l.type+(l.note?" ("+l.note+")":"")}
                              style={{background:clr+(isPending?"22":"18"),border:"1px solid "+clr+(isPending?"88":"44"),borderRadius:3,padding:"2px 5px",marginBottom:2,cursor:"pointer",opacity:isPending?0.8:1}}>
                              <div style={{color:clr,fontSize:9,fontWeight:700,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                                {isPending?<span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:clr,marginRight:3,verticalAlign:"middle"}}/>:""}{l.name.split(" ")[0]}
                              </div>
                              <div style={{color:C.ts,fontSize:8,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{l.type.split(" ")[0]}</div>
                            </div>                          );
                        })}
                        {dayLeaves.length>MAX_SHOW && (
                          <div style={{color:C.ts,fontSize:8,textAlign:"center",marginTop:1}}>+{dayLeaves.length-MAX_SHOW} more</div>
                        )}
                      </div>                    );
                  })}
                </div>              );
            })}
          </div>

          {/* Legend */}
          <div style={{padding:"10px 14px",background:C.surface,borderTop:"1px solid "+C.border,display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:10,height:10,borderRadius:2,background:"#F59E0B"}} />
              <span style={S.ts10}>Public Holiday</span>
            </div>
            {(leaveConfig.leaveTypes&&leaveConfig.leaveTypes.length ? leaveConfig.leaveTypes : Object.keys(TYPE_COLORS).map(function(k){return {name:k,color:TYPE_COLORS[k]};})).slice(0,6).map(function(lt){
              return (
                <div key={lt.name||lt.id} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:10,height:10,borderRadius:2,background:lt.color}} />
                  <span style={S.ts10}>{lt.name}</span>
                </div>              );
            })}
            <span style={{color:C.ts,fontSize:10,marginLeft:8}}>[?] = Pending approval</span>
          </div>
        </Card>
      )}

      {/* -- APPLICATIONS TAB */}
      {tab === "applications" && (
        <Card noPad style={{overflow:"hidden"}}>
          <div style={{padding:"10px 14px",background:C.surface,borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={S.tp13b}>Leave Applications</span>
            {pending.length>0 && <span style={{background:C.amberL,color:C.amber,fontWeight:700,fontSize:11,padding:"2px 10px",borderRadius:8}}>{pending.length} pending</span>}
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:C.surface}}>
                  {["Employee","Dept","Leave Type","From","To","Days","Status","Action"].map(function(h){
                    return <th key={h} style={{padding:"9px 12px",textAlign:"left",color:C.ts,fontWeight:700,borderBottom:"1px solid "+C.border,whiteSpace:"nowrap"}}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {leaves.filter(function(l){return filter==="all"||l.status===filter;}).map(function(l,i){
                  var clr = getTypeColor(l.type);
                  return (
                    <tr key={l.id} onClick={function(){setSelLeave(l);}} style={{borderBottom:"1px solid "+C.border+"44",background:i%2===0?"transparent":"#F8FAFF",cursor:"pointer"}}>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{color:C.tp,fontWeight:700}}>{l.name}</div>
                      </td>
                      <td style={{padding:"10px 12px",color:C.ts}}>{l.dept}</td>
                      <td style={{padding:"10px 12px"}}>
                        <span style={{background:clr+"18",color:clr,fontWeight:700,fontSize:11,padding:"2px 8px",borderRadius:6}}>{l.type}</span>
                      </td>
                      <td style={{padding:"10px 12px",color:C.ts,fontFamily:"monospace"}}>{l.from}</td>
                      <td style={{padding:"10px 12px",color:C.ts,fontFamily:"monospace"}}>{l.to}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:C.accent,fontWeight:700}}>{l.days}</td>
                      <td style={{padding:"10px 12px"}}><StatusChip s={l.status} /></td>
                      <td style={{padding:"10px 12px"}}>
                        {l.status==="Pending" && (
                          <div style={S.rowG4} onClick={function(e){e.stopPropagation();}}>
                            <Btn sm c={C.green} onClick={function(){approve(l.id);}}>Approve</Btn>
                            <Btn sm c={C.red}   onClick={function(){reject(l.id);}}>Reject</Btn>
                          </div>
                        )}
                      </td>
                    </tr>                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* -- APPROVAL TAB */}
      {tab === "approval" && (
        <div>
          <div style={{marginBottom:14}}>
            <div style={S.tp14b}>Leave Approval Queue</div>
            <div style={{color:C.ts,fontSize:12,marginTop:2}}>Review and approve or reject pending leave applications. Approved/rejected status is reflected immediately in the team calendar.</div>
          </div>

          {/* Email notification banner for pending */}
          {pending.length > 0 && (
            <div style={{padding:"12px 16px",background:"#EFF6FF",border:"1.5px solid "+C.accent+"44",borderRadius:10,marginBottom:14,display:"flex",alignItems:"flex-start",gap:12}}>
              <span style={{fontSize:20,marginTop:2}}>📧</span>
              <div style={{flex:1}}>
                <div style={{color:C.accent,fontWeight:700,fontSize:13}}>Auto-email sent to approver</div>
                <div style={{color:C.ts,fontSize:11,marginTop:2}}>
                  Each new leave application triggers an automated notification to: <strong>{payrollConfig.leaveNotifyEmail || payrollConfig.hrEmail || "hr@company.com.my"}</strong>
                  <div style={{marginTop:3,color:C.ts,fontStyle:"italic",fontSize:10}}>Subject: Leave Application Pending Approval - [Employee Name] - [Leave Type]</div>
                </div>
              </div>
              <span style={{background:C.accent,color:"#fff",fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:6}}>{pending.length} pending</span>
            </div>
          )}

          {pending.length === 0 && (
            <div style={{padding:32,textAlign:"center",background:C.greenL,borderRadius:12,border:"1.5px solid "+C.green+"44",marginBottom:14}}>
              <div style={{fontSize:28,marginBottom:8}}>✅</div>
              <div style={{color:C.green,fontWeight:700,fontSize:14}}>All caught up!</div>
              <div style={{color:C.ts,fontSize:12,marginTop:4}}>No pending leave applications awaiting approval.</div>
            </div>
          )}

          {/* Pending applications */}
          {pending.map(function(l){
            var clr = l.typeColor || "#0EA5C9";
            var approverEmail = payrollConfig.leaveNotifyEmail || payrollConfig.hrEmail || "hr@company.com.my";
            return (
              <div key={l.id} style={{background:C.card,border:"1.5px solid "+C.amber+"55",borderRadius:12,marginBottom:12,overflow:"hidden",borderLeft:"4px solid "+C.amber,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
                {/* Header */}
                <div style={{background:"linear-gradient(90deg,"+C.amberL+","+C.card+")",padding:"12px 18px",borderBottom:"1px solid "+C.border+"44",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={S.rowG12}>
                    <Avatar name={l.name} size={38} />
                    <div>
                      <div style={S.tp14b}>{l.name}</div>
                      <div style={S.ts11}>{l.empNo||l.empId} &middot; {l.dept}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <span style={{background:C.amberL,color:C.amber,fontWeight:700,fontSize:11,padding:"4px 12px",borderRadius:8,border:"1px solid "+C.amber+"44"}}>Pending Approval</span>
                    <span style={S.ts10}>Submitted {l.submittedOn||"-"}</span>
                  </div>
                </div>
                <div style={{padding:"14px 18px"}}>
                  {/* Details grid */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                    {[
                      ["Leave Type", l.type, clr],
                      ["From - To",  l.from+(l.from!==l.to?" to "+l.to:""), C.tp],
                      ["Duration",   l.days+" day"+(l.days!==1?"s":""), C.accent],
                      ["Approver",   payrollConfig.leaveApprover||"HR", C.purple],
                    ].map(function(item){return(
                      <div key={item[0]} style={{background:C.surface,borderRadius:7,padding:"7px 10px"}}>
                        <div style={S.ts9b}>{item[0]}</div>
                        <div style={{color:item[2],fontWeight:600,fontSize:11,marginTop:2}}>{item[1]}</div>
                      </div>                    );})}
                  </div>

                  {/* Reason */}
                  {l.note && (
                    <div style={{marginBottom:10,padding:"8px 12px",background:C.surface,borderRadius:8,borderLeft:"3px solid "+C.border}}>
                      <div style={{color:C.ts,fontSize:9,fontWeight:700,marginBottom:3}}>REASON FROM EMPLOYEE</div>
                      <div style={{color:C.tp,fontSize:12}}>{l.note}</div>
                    </div>
                  )}

                  {/* MC / Document badge */}
                  {l.docName ? (
                    <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:C.greenL,borderRadius:8,border:"1px solid "+C.green+"44"}}>
                      <span style={{fontSize:16}}>📎</span>
                      <div style={{flex:1}}>
                        <div style={{color:C.green,fontWeight:700,fontSize:11}}>{l.docName}</div>
                        <div style={S.ts10}>Supporting document attached</div>
                      </div>
                      <span style={{background:C.green,color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:5}}>MC / CERT</span>
                    </div>
                  ) : (
                    <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border+"44"}}>
                      <span style={{fontSize:14}}>📋</span>
                      <div style={S.ts11}>No supporting document attached</div>
                    </div>
                  )}

                  {/* Auto email preview */}
                  <div style={{background:"#F0F7FF",border:"1px solid "+C.accent+"33",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                      <span style={{fontSize:13}}>📧</span>
                      <span style={{color:C.accent,fontWeight:700,fontSize:11}}>Auto-notification sent to approver</span>
                    </div>
                    <div style={{fontSize:10,color:C.ts,lineHeight:1.6}}>
                      <div><span style={{fontWeight:700}}>To:</span> {approverEmail}</div>
                      <div><span style={{fontWeight:700}}>Subject:</span> [Action Required] Leave Application - {l.empNo||l.empId} {l.name} - {l.type}</div>
                      <div style={{marginTop:4,background:"#fff",borderRadius:6,padding:"6px 8px",color:C.tp,fontSize:10,lineHeight:1.8}}>
                        <div>Dear {payrollConfig.leaveApprover==="Manager"?"Manager":"HR Team"},</div>
                        <div><span style={{fontWeight:700}}>{l.name}</span> ({l.empNo||l.empId}, {l.dept}) has submitted a leave application requiring your approval.</div>
                        <div><span style={{fontWeight:700}}>Type:</span> {l.type} {"  |  "} <span style={{fontWeight:700}}>Dates:</span> {l.from}{l.from!==l.to?" to "+l.to:""} ({l.days} day{l.days!==1?"s":""})</div>
                        {l.note && <div><span style={{fontWeight:700}}>Reason:</span> {l.note}</div>}
                        {l.docName && <div><span style={{fontWeight:700}}>Document:</span> {l.docName} attached</div>}
                        <div>Please log in to the HR system to approve or reject.</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={S.rowG10}>
                    <button onClick={function(){approve(l.id);}} style={{flex:1,background:"linear-gradient(135deg,"+C.green+",#047857)",color:"#fff",border:"none",borderRadius:9,padding:"11px 0",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      Approve
                    </button>
                    <button onClick={function(){reject(l.id);}} style={{flex:1,background:"linear-gradient(135deg,#DC2626,#B91C1C)",color:"#fff",border:"none",borderRadius:9,padding:"11px 0",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      Reject
                    </button>
                    <button onClick={function(){setSelLeave(l);}} style={{background:C.surface,color:C.ts,border:"1.5px solid "+C.border,borderRadius:9,padding:"11px 14px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Details</button>
                  </div>
                </div>
              </div>            );
          })}

          {/* Recently actioned */}
          {leaves.filter(function(l){return l.status!=="Pending";}).length > 0 && (
            <div style={{marginTop:20}}>
              <div style={{color:C.ts,fontSize:11,fontWeight:700,letterSpacing:"0.8px",marginBottom:10}}>RECENTLY ACTIONED</div>
              <Card noPad style={{overflow:"hidden"}}>
                {leaves.filter(function(l){return l.status!=="Pending";}).slice(0,5).map(function(l,i){
                  var clr = l.typeColor||"#0EA5C9";
                  return(
                    <div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<4?"1px solid "+C.border+"44":"none"}}>
                      <div style={{width:4,height:40,borderRadius:2,background:clr,flexShrink:0}} />
                      <Avatar name={l.name} size={28} />
                      <div style={{flex:1}}>
                        <div style={{color:C.tp,fontWeight:600,fontSize:12}}>{l.name} <span style={S.ts10}>({l.empNo||l.empId})</span> - {l.type}</div>
                        <div style={S.ts10}>{l.from} to {l.to} ({l.days} days)</div>
                      </div>
                      <StatusChip s={l.status} />
                    </div>                  );
                })}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* -- SUMMARY TAB */}
      {tab === "summary" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12,marginBottom:16}}>
            {(employees.length ? employees : [{id:"E001",name:"Ahmad Farid",dept:"IT"},{id:"E002",name:"Lim Wei Ting",dept:"Finance"},{id:"E003",name:"Rajesh Kumar",dept:"Sales"},{id:"E004",name:"Siti Nurul Ain",dept:"HR"},{id:"E005",name:"Tan Mei Ling",dept:"IT"}]).map(function(emp){
              var empLeaves = leaves.filter(function(l){return l.empId===emp.id&&l.status==="Approved";});
              var alDays = empLeaves.filter(function(l){return l.type==="Annual Leave";}).reduce(function(s,l){return s+l.days;},0);
              var slDays = empLeaves.filter(function(l){return l.type==="Sick Leave";}).reduce(function(s,l){return s+l.days;},0);
              var totalDays = empLeaves.reduce(function(s,l){return s+l.days;},0);
              // Entitlement from config (default Permanent, < 2yrs)
              var alEntitlement = 8; var slEntitlement = 14;
              var ent = (leaveConfig.entitlements||[]).find(function(e){return e.empType==="Permanent";});
              if (ent&&ent.tiers&&ent.tiers[0]) { alEntitlement=ent.tiers[0].AL||8; slEntitlement=ent.tiers[0].SL||14; }
              return (
                <Card key={emp.id} style={{borderTop:"3px solid "+C.accent}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <Avatar name={emp.name} size={32} />
                    <div>
                      <div style={S.tp13b}>{emp.name}</div>
                      <div style={S.ts10}>{emp.dept}</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                    {[
                      ["Annual Used",  alDays+"/"+alEntitlement+" d", C.accent],
                      ["Sick Used",    slDays+"/"+slEntitlement+" d", C.green],
                      ["Total Taken",  totalDays+" days",             C.purple],
                      ["Applications", empLeaves.length,              C.ts],
                    ].map(function(r){
                      return (
                        <div key={r[0]} style={{background:C.surface,borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
                          <div style={S.ts9b}>{r[0]}</div>
                          <div style={{color:r[2],fontWeight:700,fontSize:12,marginTop:1}}>{r[1]}</div>
                        </div>                      );
                    })}
                  </div>
                  {/* AL progress bar */}
                  <div style={S.mt4}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={S.ts9}>Annual Leave balance</span>
                      <span style={{color:C.accent,fontSize:9,fontWeight:700}}>{Math.max(0,alEntitlement-alDays)} days left</span>
                    </div>
                    <div style={{background:C.border,borderRadius:4,height:5}}>
                      <div style={{background:alDays/alEntitlement>.8?C.red:C.accent,borderRadius:4,height:5,width:Math.min(100,Math.round(alDays/alEntitlement*100))+"%"}} />
                    </div>
                  </div>
                </Card>              );
            })}
          </div>

          {/* Leave type breakdown */}
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:12}}>Leave Breakdown by Type - {MONTHS_NAMES[month]} {year}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
              {(function(){
                var types = {};
                leaves.filter(function(l){return l.status==="Approved";}).forEach(function(l){
                  if (!types[l.type]) types[l.type]={count:0,days:0,color:getTypeColor(l.type)};
                  types[l.type].count++;
                  types[l.type].days+=l.days;
                });
                return Object.keys(types).map(function(typeName){
                  var t = types[typeName];
                  return (
                    <div key={typeName} style={{background:t.color+"14",border:"1.5px solid "+t.color+"33",borderRadius:10,padding:"12px 14px",borderLeft:"4px solid "+t.color}}>
                      <div style={{color:t.color,fontWeight:700,fontSize:13}}>{typeName}</div>
                      <div style={{color:C.tp,fontWeight:800,fontSize:20,marginTop:4}}>{t.days}<span style={{fontSize:11,fontWeight:400,color:C.ts}}> days</span></div>
                      <div style={{color:C.ts,fontSize:10,marginTop:2}}>{t.count} application{t.count>1?"s":""}</div>
                    </div>                  );
                });
              })()}
            </div>
          </Card>
        </div>
      )}
    </div>  );
}

// -- ATTENDANCE MODULE// -- ATTENDANCE MODULE
function AttendanceModule() {
  var INIT_ATT = [
    {id:"E001",name:"Ahmad Farid",dept:"Finance",date:"2025-06-09",in:"08:52",out:"17:35",geo:true,status:"Present",source:"Thumbprint",overrideBy:"",overrideReason:""},
    {id:"E002",name:"Siti Nurul Ain",dept:"HR",date:"2025-06-09",in:"08:30",out:"17:30",geo:true,status:"Present",source:"Thumbprint",overrideBy:"",overrideReason:""},
    {id:"E003",name:"Rajesh Kumar",dept:"IT",date:"2025-06-09",in:null,out:null,geo:false,status:"Absent",source:"--",overrideBy:"",overrideReason:""},
    {id:"E004",name:"Lim Wei Ting",dept:"Sales",date:"2025-06-09",in:"09:15",out:"18:05",geo:true,status:"Late",source:"Thumbprint",overrideBy:"",overrideReason:""},
    {id:"E005",name:"Nurul Hidayah",dept:"Operations",date:"2025-06-09",in:"08:45",out:"17:00",geo:true,status:"Present",source:"Thumbprint",overrideBy:"",overrideReason:""},
  ];
  var [records, setRecords] = useState(INIT_ATT);
  var [editId, setEditId] = useState(null);      // id of row being overridden
  var [editForm, setEditForm] = useState({});    // temp form state
  var [toast, setToast] = useState(null);

  var showToast = function(msg,c){setToast({msg:msg,c:c||C.green});setTimeout(function(){setToast(null);},3000);};

  // derive status from times
  var deriveStatus = function(timeIn, timeOut, schedIn) {
    if (!timeIn) return "Absent";
    var sched = schedIn || "08:00";
    var [sh,sm] = sched.split(":").map(Number);
    var [ih,im] = timeIn.split(":").map(Number);
    var lateMin = (ih*60+im) - (sh*60+sm);
    if (lateMin > 5) return "Late";
    return "Present";
  };

  var openEdit = function(r) {
    setEditId(r.id);
    setEditForm({in:r.in||"",out:r.out||"",overrideBy:"",overrideReason:"",status:r.status});
  };

  var saveEdit = function(r) {
    if (!editForm.overrideBy || !editForm.overrideReason) {
      showToast("Authority name and reason are required for override","#DC2626"); return;
    }
    var newStatus = deriveStatus(editForm.in, editForm.out, "08:00");
    setRecords(function(prev){
      return prev.map(function(row){
        if (row.id !== r.id) return row;
        return Object.assign({},row,{
          in: editForm.in || null,
          out: editForm.out || null,
          status: newStatus,
          source: "Manual Override",
          overrideBy: editForm.overrideBy,
          overrideReason: editForm.overrideReason,
        });
      });
    });
    setEditId(null);
    showToast("Attendance corrected & override recorded by "+editForm.overrideBy);
  };

  var cancelEdit = function() { setEditId(null); setEditForm({}); };

  var EF = function(k) { return editForm[k]||""; };
  var setEF = function(k,v) { setEditForm(function(f){return Object.assign({},f,{[k]:v});}); };

  var present = records.filter(function(r){return r.status==="Present";}).length;
  var late    = records.filter(function(r){return r.status==="Late";}).length;
  var absent  = records.filter(function(r){return r.status==="Absent";}).length;

  return (
    <div>
      {toast && (
        <div style={{position:"fixed",top:16,right:20,zIndex:9999,background:toast.c,color:"#fff",padding:"10px 20px",borderRadius:10,fontWeight:700,fontSize:12,boxShadow:"0 4px 20px rgba(0,0,0,.25)"}}>
          {toast.msg}
        </div>
      )}
      <SectionHead title="Attendance" sub="Geo-fence punch, thumbprint integration, authority override — 9 June 2025" />
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[["Present",present,C.green,C.greenL],["Late",late,C.amber,C.amberL],["Absent",absent,C.red,C.redL],["Total",records.length,C.accent,C.accentL]].map(function(item,i){
          return (
            <Card key={i} style={{background:item[3],padding:"14px 16px"}}>
              <div style={S.ts10b}>{item[0].toUpperCase()}</div>
              <div style={{color:item[2],fontSize:28,fontWeight:900,marginTop:2}}>{item[1]}</div>
            </Card>          );
        })}
      </div>

      {/* Override legend */}
      <div style={{background:C.amberL,borderRadius:8,padding:"8px 14px",marginBottom:12,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{color:C.amber,fontWeight:700,fontSize:12}}>⚡ Authority Override</span>
        <span style={{color:"#92400E",fontSize:11}}>HR Manager / Payroll Admin may correct time-in/out. All overrides are logged with authority name, reason and timestamp for audit trail.</span>
      </div>

      <Card noPad style={{overflow:"hidden"}}>
        <div style={{padding:"12px 16px",background:C.surface,borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={S.tp14b}>Today — 9 June 2025</span>
          <Chip text="Live" c={C.green} />
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:C.surface}}>
              {["Employee","Dept","Check In","Check Out","Geo","Status","Source","Override Log","Action"].map(function(h){
                return <th key={h} style={{padding:"9px 12px",textAlign:"left",color:C.ts,fontSize:11,fontWeight:700,borderBottom:"1px solid "+C.border,whiteSpace:"nowrap"}}>{h}</th>;
              })}
            </tr></thead>
            <tbody>
              {records.map(function(r,i){
                var isEditing = editId === r.id;
                return (
                  <tr key={r.id} style={{borderBottom:"1px solid "+C.border+"44",background:isEditing?C.accentL+"55":i%2===0?"transparent":"#F8FAFF"}}>
                    <td style={{padding:"10px 12px"}}>
                      <div style={{color:C.tp,fontWeight:700,fontSize:13}}>{r.name}</div>
                      <div style={S.ts10}>{r.id}</div>
                    </td>
                    <td style={{padding:"10px 12px",color:C.ts,fontSize:12}}>{r.dept}</td>

                    {isEditing ? (
                      <>
                        <td style={{padding:"6px 8px"}}>
                          <input type="time" value={EF("in")} onChange={function(e){setEF("in",e.target.value);}}
                            style={{padding:"5px 8px",border:"1.5px solid "+C.accent,borderRadius:6,fontSize:12,fontFamily:"inherit",width:90}} />
                        </td>
                        <td style={{padding:"6px 8px"}}>
                          <input type="time" value={EF("out")} onChange={function(e){setEF("out",e.target.value);}}
                            style={{padding:"5px 8px",border:"1.5px solid "+C.accent,borderRadius:6,fontSize:12,fontFamily:"inherit",width:90}} />
                        </td>
                        <td style={{padding:"6px 8px"}}>
                          <span style={{color:C.ts,fontSize:11}}>{r.geo?"✓ GPS":"✗ No GPS"}</span>
                        </td>
                        <td style={{padding:"6px 8px"}}>
                          <span style={{color:C.accent,fontWeight:700,fontSize:11}}>
                            {deriveStatus(EF("in"),EF("out"),"08:00")}
                          </span>
                        </td>
                        <td style={{padding:"6px 8px",color:C.ts,fontSize:11}}>Manual Override</td>
                        <td style={{padding:"6px 8px",minWidth:240}}>
                          <input value={EF("overrideBy")} onChange={function(e){setEF("overrideBy",e.target.value);}}
                            placeholder="Authority name (required)" style={{width:"100%",padding:"5px 8px",border:"1.5px solid "+C.border,borderRadius:6,fontSize:11,fontFamily:"inherit",marginBottom:4}} />
                          <input value={EF("overrideReason")} onChange={function(e){setEF("overrideReason",e.target.value);}}
                            placeholder="Reason for override (required)" style={{width:"100%",padding:"5px 8px",border:"1.5px solid "+C.border,borderRadius:6,fontSize:11,fontFamily:"inherit"}} />
                        </td>
                        <td style={{padding:"6px 8px"}}>
                          <div style={{display:"flex",gap:4,flexDirection:"column"}}>
                            <button onClick={function(){saveEdit(r);}} style={{background:C.green,color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Save</button>
                            <button onClick={cancelEdit} style={{background:C.surface,color:C.ts,border:"1px solid "+C.border,borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{padding:"10px 12px",color:r.in?C.green:C.red,fontWeight:r.in?700:400}}>{r.in||"--"}</td>
                        <td style={{padding:"10px 12px",color:r.out?C.accent:C.ts}}>{r.out||"--"}</td>
                        <td style={{padding:"10px 12px"}}><span style={{color:r.geo?C.green:C.red,fontWeight:700,fontSize:12}}>{r.geo?"✓ GPS":"✗ None"}</span></td>
                        <td style={{padding:"10px 12px"}}><StatusChip s={r.status} /></td>
                        <td style={{padding:"10px 12px",color:C.ts,fontSize:11}}>{r.source}</td>
                        <td style={{padding:"10px 12px",minWidth:180}}>
                          {r.overrideBy ? (
                            <div style={{background:C.amberL,borderRadius:6,padding:"5px 8px"}}>
                              <div style={{color:C.amber,fontWeight:700,fontSize:11}}>Overridden by: {r.overrideBy}</div>
                              <div style={{color:"#92400E",fontSize:10,marginTop:2}}>{r.overrideReason}</div>
                            </div>
                          ) : <span style={{color:C.tm,fontSize:11}}>—</span>}
                        </td>
                        <td style={{padding:"10px 12px"}}>
                          <button onClick={function(){openEdit(r);}} style={{background:C.accentL,color:C.accent,border:"none",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                            ✏ Override
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:"8px 14px",background:C.surface,borderTop:"1px solid "+C.border,color:C.ts,fontSize:11}}>
          All overrides require authority name + reason and are permanently logged for audit trail.
        </div>
      </Card>
    </div>  );
}

// -- CLAIMS MODULE
var claimsData = [
  {id:"C001",name:"Ahmad Farid",type:"Travel",amount:320.50,date:"2025-06-05",status:"Pending",merchant:"Petronas TTDI",ocr:true},
  {id:"C002",name:"Lim Wei Ting",type:"Medical",amount:185.00,date:"2025-06-07",status:"Approved",merchant:"Klinik Kesihatan PJ",ocr:true},
  {id:"C003",name:"Rajesh Kumar",type:"Entertainment",amount:980.00,date:"2025-06-06",status:"Flagged",merchant:"Unknown",ocr:false},
  {id:"C004",name:"Nurul Hidayah",type:"Mileage",amount:156.80,date:"2025-06-08",status:"Pending",merchant:"Auto-calc",ocr:false},
];

function ClaimsModule() {
  var [claims, setClaims] = useState(claimsData);
  var approve = function(id) { setClaims(function(prev){return prev.map(function(c){return c.id===id?Object.assign({},c,{status:"Approved"}):c;});}); };
  var reject = function(id) { setClaims(function(prev){return prev.map(function(c){return c.id===id?Object.assign({},c,{status:"Rejected"}):c;});}); };
  return (
    <div>
      <SectionHead title="Claims and OCR" sub="Expense claims with AI receipt scanning and auto-extraction" />
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[
          {l:"Total Claims",v:claims.length,c:C.accent,bg:C.accentL},
          {l:"Pending",v:claims.filter(function(c){return c.status==="Pending";}).length,c:C.amber,bg:C.amberL},
          {l:"Flagged",v:claims.filter(function(c){return c.status==="Flagged";}).length,c:C.red,bg:C.redL},
          {l:"Total Amount",v:"RM "+claims.reduce(function(s,c){return s+c.amount;},0).toFixed(2),c:C.green,bg:C.greenL,isStr:true},
        ].map(function(item) {
          return (
            <Card key={item.l} style={{background:item.bg,padding:"14px 16px"}}>
              <div style={S.ts10b}>{item.l.toUpperCase()}</div>
              <div style={{color:item.c,fontSize:item.isStr?16:28,fontWeight:900,marginTop:2}}>{item.isStr?item.v:item.v}</div>
            </Card>          );
        })}
      </div>
      <Card noPad style={{overflow:"hidden"}}>
        <table style={S.tbl}>
          <thead><tr style={{background:C.surface}}>
            {["Ref","Employee","Type","Amount","Date","Merchant","OCR","Status","Action"].map(function(h) {
              return <th key={h} style={{padding:"8px 12px",textAlign:"left",color:C.ts,fontSize:11,fontWeight:700,borderBottom:"1px solid "+C.border}}>{h}</th>;
            })}
          </tr></thead>
          <tbody>
            {claims.map(function(c,i) {
              return (
                <tr key={c.id} style={{borderBottom:"1px solid "+C.border+"44",background:i%2===0?"transparent":"#F8FAFF"}}>
                  <td style={{padding:"10px 12px",color:C.accent,fontWeight:600,fontSize:12}}>{c.id}</td>
                  <td style={{padding:"10px 12px",color:C.tp,fontWeight:600,fontSize:13}}>{c.name}</td>
                  <td style={{padding:"10px 12px",color:C.ts,fontSize:12}}>{c.type}</td>
                  <td style={{padding:"10px 12px",color:C.green,fontWeight:700}}>RM {c.amount.toFixed(2)}</td>
                  <td style={{padding:"10px 12px",color:C.ts,fontSize:12}}>{c.date}</td>
                  <td style={{padding:"10px 12px",color:C.ts,fontSize:12}}>{c.merchant}</td>
                  <td style={{padding:"10px 12px"}}><Chip text={c.ocr?"OCR":"Manual"} c={c.ocr?C.green:C.ts} /></td>
                  <td style={{padding:"10px 12px"}}><StatusChip s={c.status} /></td>
                  <td style={{padding:"10px 12px"}}>
                    {(c.status==="Pending"||c.status==="Flagged") && (
                      <div style={S.rowG4}>
                        <Btn sm c={C.green} onClick={function(){approve(c.id);}}>Approve</Btn>
                        <Btn sm c={C.red} onClick={function(){reject(c.id);}}>Reject</Btn>
                      </div>
                    )}
                  </td>
                </tr>              );
            })}
          </tbody>
        </table>
      </Card>
    </div>  );
}

// -- AI ENGINE MODULE
var AI_CONTEXT = "You are an expert Malaysia HR and payroll assistant embedded in HRCloud. Company: TechCorp Sdn. Bhd., 247 employees. Malaysia statutory: EPF EE 11%/ER 12-13%, SOCSO First Schedule, EIS 0.2%, PCB via LHDN 2024 table, HRDF 1%. June 2025 payroll: Gross RM 1,240,000, EPF ER RM 136,400, PCB RM 98,800, Net RM 994,980. Statutory deadlines: EPF/SOCSO/EIS/PCB all due 15 Jun. Minimum wage RM 1,700. Maternity leave 98 days. Respond professionally in English, use RM for currency.";

var QUICK_PROMPTS = [
  "What is EPF contribution rate for age 60 and above?",
  "Calculate PCB for RM 5,800 salary, married with 2 children",
  "When is the SOCSO submission deadline for June 2025?",
  "Explain the salary anomaly alert for Rajesh Kumar",
  "What are annual leave entitlements under Employment Act 1955?",
  "How do I calculate overtime pay for a public holiday?",
];

var EXTENDED_ALERTS = [
  {id:"a1",type:"Salary Anomaly",sev:"HIGH",cat:"Payroll",emp:"Rajesh Kumar Nair",
   desc:"Salary increased 35% from RM 7,000 to RM 7,500 - exceeds 30% policy threshold.",
   rec:"Request HR Director approval and document justification before processing.",score:0.87},
  {id:"a2",type:"Duplicate Claim",sev:"HIGH",cat:"Claims",emp:"Rajesh Kumar Nair",
   desc:"C003 receipt hash matches a submission from 06 Jun. Same merchant and amount.",
   rec:"Hold claim C003 and request original receipt from employee.",score:0.94},
  {id:"a3",type:"PCB Under-Deduction",sev:"MEDIUM",cat:"Tax",emp:"Lim Wei Ting",
   desc:"Projected annual tax gap of RM 1,240 based on current monthly deduction.",
   rec:"Review PCB table and adjust monthly deduction to avoid year-end shortfall.",score:0.61},
  {id:"a4",type:"Maternity Coverage Gap",sev:"LOW",cat:"Leave",emp:"Siti Nurul Ain",
   desc:"No backup assigned for 98-day maternity leave starting 1 July 2025.",
   rec:"Assign interim coverage for HR Executive role before leave start date.",score:0.42},
  {id:"a5",type:"Probation Expiry",sev:"MEDIUM",cat:"HR",emp:"Nurul Hidayah binti Razak",
   desc:"Status tagged as Probation but employee has 15 years of service since 2010.",
   rec:"Update employment status to Permanent immediately.",score:0.55},
];

function AIModule() {
  var [aiTab, setAiTab] = useState("chat");
  var _m = useState([
    {role:"assistant",content:"Selamat datang! I'm your HRCloud AI Assistant for Malaysia payroll and HR.\n\nI have full context of your statutory obligations (EPF, SOCSO, EIS, PCB, HRDF), employee data, and June 2025 payroll.\n\nAsk me anything about payroll calculations, compliance deadlines, or HR policy."}
  ]);
  var messages = _m[0]; var setMessages = _m[1];
  var [input, setInput] = useState("");
  var [loading, setLoading] = useState(false);
  var [dismissed, setDismissed] = useState({});
  var chatEndRef = useRef(null);

  var sendMessage = function() {
    if (!input.trim() || loading) return;
    var userMsg = {role:"user", content:input.trim()};
    var newMsgs = messages.concat([userMsg]);
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    var apiMsgs = newMsgs.map(function(m) { return {role:m.role, content:m.content}; });

    fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:1000,
        system:AI_CONTEXT,
        messages:apiMsgs,
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var reply = "";
      if (data.content && data.content.length > 0) {
        reply = data.content.map(function(b) { return b.text || ""; }).join("");
      } else {
        reply = "Sorry, I could not get a response. Please try again.";
      }
      setMessages(function(prev) { return prev.concat([{role:"assistant",content:reply}]); });
      setLoading(false);
    })
    .catch(function() {
      setMessages(function(prev) { return prev.concat([{role:"assistant",content:"Connection error. Please check your network and try again."}]); });
      setLoading(false);
    });
  };

  var askAboutAlert = function(alert) {
    setAiTab("chat");
    setInput("Explain this risk: " + alert.type + " - " + alert.desc);
  };

  var dismissAlert = function(id) {
    setDismissed(function(prev) {
      var n = Object.assign({}, prev);
      n[id] = true;
      return n;
    });
  };

  var activeAlerts = EXTENDED_ALERTS.filter(function(a) { return !dismissed[a.id]; });
  var highCount = EXTENDED_ALERTS.filter(function(a) { return a.sev === "HIGH"; }).length;
  var medCount = EXTENDED_ALERTS.filter(function(a) { return a.sev === "MEDIUM"; }).length;
  var lowCount = EXTENDED_ALERTS.filter(function(a) { return a.sev === "LOW"; }).length;
  var dismissedCount = Object.keys(dismissed).length;

  return (
    <div>
      <SectionHead title="AI Engine" sub="Claude-powered HR assistant, risk detection and workforce insights" />
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["chat","💬 HR Assistant"],["alerts","Risk Alerts (" + activeAlerts.length + ")"],["insights","Workforce Insights"]].map(function(t) {
          return (
            <button key={t[0]} onClick={function(){setAiTab(t[0]);}} style={{
              background:aiTab===t[0]?"linear-gradient(135deg,#0EA5C9,#0369A1)":"transparent",
              color:aiTab===t[0]?"#fff":C.ts,
              border:"1.5px solid "+(aiTab===t[0]?C.accent:C.border),
              borderRadius:8,padding:"8px 20px",fontSize:12,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit",
            }}>{t[1]}</button>          );
        })}
      </div>

      {aiTab === "chat" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16}}>
          <Card noPad style={{overflow:"hidden",display:"flex",flexDirection:"column",height:580}}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#0EA5C9,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤖</div>
              <div>
                <div style={S.tp14b}>HRCloud AI Assistant</div>
                <div style={{color:C.green,fontSize:11,fontWeight:600}}>Online - Malaysia HR specialist</div>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:12}}>
              {messages.map(function(msg, i) {
                var isAi = msg.role === "assistant";
                return (
                  <div key={i} style={{display:"flex",gap:10,justifyContent:isAi?"flex-start":"flex-end"}}>
                    {isAi && (
                      <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#0EA5C9,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🤖</div>
                    )}
                    <div style={{
                      maxWidth:"75%",background:isAi?C.accentL:"linear-gradient(135deg,#0EA5C9,#0369A1)",
                      color:isAi?C.tp:"#fff",borderRadius:isAi?"4px 14px 14px 14px":"14px 4px 14px 14px",
                      padding:"10px 14px",fontSize:13,lineHeight:1.7,
                    }}>
                      {msg.content.split("\n").map(function(line, j) { return <span key={j}>{line}{j < msg.content.split("\n").length - 1 ? <br/> : null}</span>; })}
                    </div>
                  </div>                );
              })}
              {loading && (
                <div style={S.rowG10}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#0EA5C9,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🤖</div>
                  <div style={{background:C.accentL,borderRadius:"4px 14px 14px 14px",padding:"12px 16px"}}>
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      {[0,1,2].map(function(j) {
                        return <div key={j} style={{width:7,height:7,borderRadius:"50%",background:C.accent,opacity:0.5,animation:"pulse 1.2s ease-in-out "+(j*0.2)+"s infinite"}} />;
                      })}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid "+C.border,display:"flex",gap:8}}>
              <input
                value={input}
                onChange={function(e){setInput(e.target.value);}}
                onKeyDown={function(e){if(e.key==="Enter")sendMessage();}}
                placeholder="Ask about payroll, statutory, HR policy..."
                style={Object.assign({},inputStyle,{flex:1,marginBottom:0})}
              />
              <Btn c={C.accent} onClick={sendMessage} disabled={loading || !input.trim()}>Send</Btn>
            </div>
          </Card>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:10}}>Quick Prompts</div>
              {QUICK_PROMPTS.map(function(p, i) {
                return (
                  <button key={i} onClick={function(){setInput(p);}}
                    style={{display:"block",width:"100%",textAlign:"left",background:C.surface,
                      border:"1px solid "+C.border,borderRadius:8,padding:"8px 10px",
                      marginBottom:6,color:C.ts,fontSize:11,cursor:"pointer",fontFamily:"inherit",
                      lineHeight:1.4,transition:"all .12s"}}>
                    {p}
                  </button>                );
              })}
            </Card>
          </div>
        </div>
      )}

      {aiTab === "alerts" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            {[["High Risk",highCount,C.red,C.redL],["Medium Risk",medCount,C.amber,C.amberL],
              ["Low Risk",lowCount,C.green,C.greenL],["Dismissed",dismissedCount,C.ts,C.surface]].map(function(item,i) {
              return (
                <Card key={i} style={{background:item[3],padding:"14px 16px"}}>
                  <div style={S.ts10b}>{item[0].toUpperCase()}</div>
                  <div style={{color:item[2],fontSize:28,fontWeight:900,marginTop:2}}>{item[1]}</div>
                </Card>              );
            })}
          </div>
          {activeAlerts.map(function(alert) {
            return (
              <Card key={alert.id} style={{marginBottom:12,borderLeft:"4px solid "+(alert.sev==="HIGH"?C.red:alert.sev==="MEDIUM"?C.amber:C.green)}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontSize:22}}>{alert.sev==="HIGH"?"🔴":alert.sev==="MEDIUM"?"🟡":"🟢"}</span>
                    <div>
                      <div style={S.tp14b}>{alert.type}</div>
                      <div style={S.ts11}>{alert.cat} - {alert.emp}</div>
                    </div>
                  </div>
                  <div style={S.rowG6}>
                    <StatusChip s={alert.sev} />
                    <Btn sm c={C.ts} onClick={function(){dismissAlert(alert.id);}}>Dismiss</Btn>
                  </div>
                </div>
                <div style={{color:C.ts,fontSize:13,lineHeight:1.6,marginBottom:8}}>{alert.desc}</div>
                <div style={{background:C.accentL,borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:C.tp}}>
                  <strong>Recommendation:</strong> {alert.rec}
                </div>
                <div style={S.rowJSB}>
                  <RiskBar score={alert.score} />
                  <Btn sm c={C.accent} onClick={function(){askAboutAlert(alert);}}>Ask AI</Btn>
                </div>
              </Card>            );
          })}
          {activeAlerts.length === 0 && (
            <Card style={{textAlign:"center",padding:40}}>
              <div style={{marginBottom:12,color:C.green,display:"flex",justifyContent:"center"}}><CheckCircle size={48}/></div>
              <div style={S.tp15b}>All alerts dismissed</div>
            </Card>
          )}
        </div>
      )}

      {aiTab === "insights" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            {[["Payroll Cost Ratio","28.4%",C.accent,C.accentL],["Avg OT Hours","4.2 hrs",C.amber,C.amberL],
              ["Attendance Rate","94.6%",C.green,C.greenL],["Claims Per Head","RM 50.30",C.purple,C.purpleL]].map(function(item) {
              return (
                <Card key={item[0]} style={{background:item[3],padding:"16px 18px"}}>
                  <div style={S.ts10b}>{item[0].toUpperCase()}</div>
                  <div style={{color:item[2],fontSize:22,fontWeight:900,marginTop:4}}>{item[1]}</div>
                </Card>              );
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <Card>
              <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>Department Headcount</div>
              {[["Finance",52],["IT",71],["Sales",63],["HR",38],["Operations",23]].map(function(item) {
                return (
                  <div key={item[0]} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={S.ts12}>{item[0]}</span>
                      <span style={S.tp12b}>{item[1]}</span>
                    </div>
                    <div style={{background:C.surface,borderRadius:4,height:8,overflow:"hidden"}}>
                      <div style={{width:(item[1]/71*100)+"%",height:"100%",background:C.accent,borderRadius:4}} />
                    </div>
                  </div>                );
              })}
            </Card>
            <Card>
              <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>Salary Band Distribution</div>
              {[["Below RM 3,000",18],["RM 3,001-5,000",89],["RM 5,001-8,000",94],["RM 8,001-12,000",36],["Above RM 12,000",10]].map(function(item) {
                return (
                  <div key={item[0]} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={S.ts11}>{item[0]}</span>
                      <span style={S.tp12b}>{item[1]} staff</span>
                    </div>
                    <div style={{background:C.surface,borderRadius:4,height:8,overflow:"hidden"}}>
                      <div style={{width:(item[1]/94*100)+"%",height:"100%",background:C.green,borderRadius:4}} />
                    </div>
                  </div>                );
              })}
            </Card>
          </div>
          <Card style={{background:"linear-gradient(135deg,#EBF6FC,#EDE9FE)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <span style={{fontSize:24}}>🤖</span>
              <div style={S.tp14b}>AI Monthly Summary - June 2025</div>
            </div>
            {[["Statutory Compliance","3 items due 15 Jun totalling RM 242,570. All pending submission."],
              ["Payroll Anomalies","2 high-risk flags require review before finalising June payroll."],
              ["Workforce Trend","Stable headcount. Maternity coverage gap identified in HR department."]].map(function(item) {
              return (
                <div key={item[0]} style={{marginBottom:10}}>
                  <div style={S.tp13b}>{item[0]}</div>
                  <div style={{color:C.ts,fontSize:12,lineHeight:1.6,marginTop:2}}>{item[1]}</div>
                </div>              );
            })}
          </Card>
        </div>
      )}
    </div>  );
}

// -- REPORTS MODULE
// Borang E knowledge:
// Form E (CP8) = Annual employer return submitted to LHDN by 31 March
// Contains: employer details, total employees, total remuneration paid, total MTD/PCB deducted
// Sections: Part A (Employer details), Part B (Employee summary count), Part C (Total remuneration)
// Must list each employee with name, NRIC, income, PCB
//
// Borang EA (CP8A) = Employee income statement issued by 28 February each year
// Contains: employer info, employee info, income breakdown, statutory deductions, tax details
// Sections: A(employer), B(employee details), C(employment income), D(benefits in kind),
//           E(statutory deductions EPF/SOCSO), F(tax deducted PCB)

function buildEA(emp, yr) {
  var r = computeRow(emp, 26, {});
  var b1a = parseFloat((r.basic * 12).toFixed(2));
  var b1b = parseFloat(((r.bonus||0) * 12).toFixed(2));
  var travelAnnual = parseFloat(((r.travel||0) * 12).toFixed(2));
  var travelExempt = Math.min(travelAnnual, 6000);
  var travelTaxable = Math.max(0, travelAnnual - 6000);
  var b1c = parseFloat(((r.other||0) * 12 + travelTaxable).toFixed(2));
  var b1d = 0; var b1e = 0; var b1f = 0;
  var b2 = 0; var b3 = 0; var b4 = 0; var b5 = 0; var b6 = 0;
  var c1 = 0; var c2 = 0;
  var d1 = parseFloat((r.pcb * 12).toFixed(2));
  var d2 = 0; var d3 = 0; var d4 = 0; var d5a = 0; var d5b = 0;
  var d6 = parseFloat(((emp.pcbChildren||0) * 2000).toFixed(2));
  var e1 = parseFloat((r.epfEe * 12).toFixed(2));
  var e2 = parseFloat((r.socsoEe * 12).toFixed(2));
  var f_total = parseFloat(travelExempt.toFixed(2));
  var grand = parseFloat((b1a+b1b+b1c+b1d+b1e+b1f+b2+b3+b4+b5+b6+c1+c2).toFixed(2));
  return {
    emp, yr, r, b1a, b1b, b1c, b1d, b1e, b1f,
    b2, b3, b4, b5, b6, c1, c2, grand,
    d1, d2, d3, d4, d5a, d5b, d6,
    e1_name:"EPF", e1_amt:e1, e2_amt:e2, f_total,
    // legacy compat
    annualBasic:b1a, annualGross:grand, annualEpfEe:e1, annualSocsoEe:e2, annualPCB:d1,
    grossSalary:grand, totalPCB:d1, totalEPF:e1, bikValue:b3,
  };
}

// ── Borang EA (CP8A Pin.2024) — Official LHDN format exact replica ──────────
function generateEaPDF(d, lang, co) {
  var BM  = (lang === "BM");
  var emp = d.emp || {};
  var yr  = d.yr  || 2025;
  co = co || {};

  var fmt = function(v) {
    var n = parseFloat(v || 0);
    if (n === 0) return "";
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  var fmtZ = function(v) {
    return parseFloat(v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  var today   = new Date();
  var dateStr = String(today.getDate()).padStart(2,"0") + "/" +
                String(today.getMonth()+1).padStart(2,"0") + "/" + today.getFullYear();
  var addrArr = [co.addr1, co.addr2,
                 ((co.postcode||"") + " " + (co.city||"")).trim(), co.state]
                .map(function(x){ return (x||"").trim(); }).filter(Boolean);
  var addrStr = addrArr.join(", ");

  var T = BM ? {
    title:"PENYATA SARAAN DARIPADA PENGGAJIAN", yr:"BAGI TAHUN BERAKHIR 31 DISEMBER "+yr,
    sector:"SEKTOR SWASTA Penyata Saraan Pekerja", notice:"BORANG EA INI PERLU DISEDIAKAN UNTUK DISERAHKAN KEPADA PEKERJA BAGI TUJUAN CUKAI PENDAPATANNYA",
    tin_emp:"TIN Majikan E", tin_ee:"No. Pengenalan Cukai (TIN) Pekerja", state:"Negeri LHDNM",
    sn:"No. Siri",
    secA:"BUTIRAN PEKERJA",
    f1:"1. Nama Penuh Pekerja/Pesara (En./Cik/Puan)", f2:"2. Jawatan", f3:"3. No. Kakitangan / No. Gaji",
    f4:"4. No. K.P. Baru", f5:"5. No. Pasport", f6:"6. No. KWSP", f7:"7. No. PERKESO",
    f8:"8. Bilangan anak yang layak untuk pelepasan cukai",
    f9:"9. Jika bekerja tidak genap setahun, nyatakan:", f9a:"(a) Tarikh mula bekerja", f9b:"(b) Tarikh berhenti kerja",
    secB:"B  PENDAPATAN PENGGAJIAN, MANFAAT DAN TEMPAT KEDIAMAN",
    secBsub:"(Tidak Termasuk Elaun/Perkuisit/Pemberian/Manfaat Yang Dikecualikan Cukai)",
    b1a:"1.(a) Gaji kasar, upah atau gaji cuti (termasuk gaji lebih masa)",
    b1b:"   (b) Fi (termasuk fi pengarah), komisen atau bonus",
    b1c:"   (c) Tip kasar, perkuisit, penerimaan/sagu hati atau elaun-elaun lain",
    b1c2:"         (Perihal pembayaran: .................................................)",
    b1d:"   (d) Cukai pendapatan yang dibayar oleh majikan bagi pihak pekerja",
    b1e:"   (e) Manfaat Skim Opsyen Saham Pekerja (ESOS)",
    b1f:"   (f) Ganjaran bagi tempoh dari .................. hingga ..................",
    b2:"2. Butiran bayaran tunggakan dan lain-lain bagi tahun-tahun terdahulu",
    b2a:"      Jenis pendapatan  (a) ......................................",
    b2b:"                        (b) ......................................",
    b3:"3. Manfaat berupa barangan (Nyatakan: ........................................................)",
    b4:"4. Nilai tempat kediaman yang disediakan (Alamat: .................................)",
    b5:"5. Bayaran balik daripada Kumpulan Wang Simpanan/Pencen yang tidak diluluskan",
    b6:"6. Pampasan kerana kehilangan pekerjaan",
    secC:"C  PENCEN DAN LAIN-LAIN", total:"JUMLAH",
    c1:"1. Pencen", c2:"2. Anuiti atau bayaran berkala yang lain",
    secD:"D  JUMLAH POTONGAN",
    d1:"1. Potongan cukai bulanan (PCB) yang dibayar kepada LHDNM",
    d2:"2. Arahan potongan CP38 yang dibayar kepada LHDNM",
    d3:"3. Zakat yang dibayar melalui potongan gaji",
    d4:"4. Derma/hadiah/sumbangan diluluskan yang dibayar melalui potongan gaji",
    d5:"5. Jumlah tuntutan potongan oleh pekerja melalui Borang TP1 berkaitan:",
    d5a:"      (a) Pelepasan  RM ......................................",
    d5b:"      (b) Zakat selain yang dibayar melalui potongan gaji  RM ......................",
    d6:"6. Jumlah pelepasan bagi anak yang layak",
    secE:"E  CARUMAN YANG DIBAYAR OLEH PEKERJA KEPADA KUMPULAN WANG SIMPANAN/PENCEN YANG DILULUSKAN DAN PERKESO",
    e1n:"1. Nama Kumpulan Wang", e1a:"   Amaun caruman yang wajib dibayar (nyatakan bahagian pekerja sahaja)",
    e2:"2. PERKESO: Amaun caruman yang wajib dibayar (nyatakan bahagian pekerja sahaja)",
    secF:"F  JUMLAH ELAUN/PERKUISIT/PEMBERIAN/MANFAAT YANG DIKECUALIKAN CUKAI",
    off:"Nama Pegawai", des:"Jawatan", addr:"Nama dan Alamat Majikan", ph:"No. Telefon Majikan", dt:"Tarikh",
    cp:"(C.P. 8A - Pin. 2024)", tag:"MALAYSIA", tax:"CUKAI PENDAPATAN",
  } : {
    title:"STATEMENT OF REMUNERATION FROM EMPLOYMENT", yr:"FOR THE YEAR ENDED 31 DECEMBER "+yr,
    sector:"PRIVATE SECTOR Employee's Statement of Remuneration", notice:"THIS FORM EA MUST BE PREPARED AND PROVIDED TO THE EMPLOYEE FOR INCOME TAX PURPOSE",
    tin_emp:"Employer's TIN  E", tin_ee:"Employee's Tax Identification No. (TIN)", state:"LHDNM State",
    sn:"Serial No.",
    secA:"A  PARTICULARS OF EMPLOYEE",
    f1:"1. Full Name of Employee / Pensioner (Mr./Miss/Madam)", f2:"2. Job Designation", f3:"3. Staff No. / Payroll No.",
    f4:"4. New I.C. No", f5:"5. Passport No.", f6:"6. EPF No.", f7:"7. SOCSO No.",
    f8:"8. Number of children qualified for tax relief",
    f9:"9. If the period of employment is less than a year, please state:", f9a:"(a) Date of commencement", f9b:"(b) Date of cessation",
    secB:"B  EMPLOYMENT INCOME, BENEFITS AND LIVING ACCOMMODATION",
    secBsub:"(Excluding Tax Exempt Allowances / Perquisites / Gifts / Benefits)",
    b1a:"1.(a) Gross salary, wages or leave pay (including overtime pay)",
    b1b:"   (b) Fees (including director fees), commission or bonus",
    b1c:"   (c) Gross tips, perquisites, awards / rewards or other allowances",
    b1c2:"         (Details of payment: .................................................)",
    b1d:"   (d) Income tax borne by the employer in respect of his employee",
    b1e:"   (e) Employee Share Option Scheme (ESOS) benefit",
    b1f:"   (f) Gratuity for the period from .................. to ..................",
    b2:"2. Details of arrears and others for preceding years paid in the current year",
    b2a:"      Type of income  (a) ......................................",
    b2b:"                      (b) ......................................",
    b3:"3. Benefits in kind (Specify: ..........................................................)",
    b4:"4. Value of living accommodation provided (Address: .................................)",
    b5:"5. Refund from unapproved Provident / Pension Fund",
    b6:"6. Compensation for loss of employment",
    secC:"C  PENSION AND OTHERS", total:"TOTAL",
    c1:"1. Pension", c2:"2. Annuities or other periodical payments",
    secD:"D  TOTAL DEDUCTION",
    d1:"1. Monthly tax deductions (MTD) remitted to LHDNM",
    d2:"2. CP38 deductions remitted to LHDNM",
    d3:"3. Zakat paid via salary deduction",
    d4:"4. Approved donations / gifts / contributions via salary deduction",
    d5:"5. Total claim for deduction by employee via Form TP1 in respect of:",
    d5a:"      (a) Relief  RM ......................................",
    d5b:"      (b) Zakat other than that paid via monthly salary deduction  RM ......................",
    d6:"6. Total qualifying child relief",
    secE:"E  CONTRIBUTIONS PAID BY EMPLOYEE TO APPROVED PROVIDENT / PENSION FUND AND SOCSO",
    e1n:"1. Name of Provident Fund", e1a:"   Amount of compulsory contribution paid (state the employee's share of contribution only)",
    e2:"2. SOCSO: Amount of compulsory contribution paid (state the employee's share of contribution only)",
    secF:"F  TOTAL TAX EXEMPT ALLOWANCES / PERQUISITES / GIFTS / BENEFITS",
    off:"Name of Officer", des:"Designation", addr:"Name and Address of Employer", ph:"Employer's Telephone No.", dt:"Date",
    cp:"(C.P. 8A - Pin. 2024)", tag:"MALAYSIA", tax:"INCOME TAX",
  };

  // ── Row builder helpers ────────────────────────────────────────────────
  var R = function(lbl, val, bold) {
    var amt = fmt(val);
    return '<tr>' +
      '<td class="lbl'+(bold?" bold":"")+'">'+lbl+'</td>' +
      '<td class="amt'+(bold?" bold":"")+'"><span class="amt-val">'+(amt||"")+'</span></td>' +
      '</tr>';
  };
  var RL = function(lbl) { return '<tr><td class="lbl" colspan="2" style="padding-top:3px;padding-bottom:1px;font-style:italic;color:#555;">'+lbl+'</td></tr>'; };
  var RH = function(lbl) { return '<tr><td colspan="2" class="sec-row"><b>'+lbl+'</b></td></tr>'; };
  var SEP = '<tr><td colspan="2"><hr style="border:none;border-top:1px solid #999;margin:3px 0"></td></tr>';

  var cp38Total = (emp.cp38Amount||0) * 12;

  var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n' +
    '<title>Borang EA '+yr+' - '+(emp.name||"Employee")+'</title>\n' +
    '<style>\n' +
    '* { box-sizing:border-box; margin:0; padding:0; }\n' +
    'body { background:#e8e8e8; font-family:Arial,Helvetica,sans-serif; font-size:10px; padding:12px; }\n' +
    '.print-btn { background:#1E40AF; color:#fff; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; margin-bottom:12px; display:inline-block; }\n' +
    '.page { background:#fff; width:190mm; margin:0 auto; padding:8mm 10mm; border:1px solid #aaa; box-shadow:0 2px 8px rgba(0,0,0,.2); }\n' +
    '/* Header area */\n' +
    '.hdr { display:flex; align-items:stretch; border:1.5px solid #000; margin-bottom:0; }\n' +
    '.hdr-left { border-right:1px solid #000; padding:6px 8px; min-width:220px; font-size:8.5px; line-height:1.5; }\n' +
    '.hdr-mid { border-right:1px solid #000; padding:6px 8px; flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }\n' +
    '.hdr-right { padding:6px 8px; min-width:180px; display:flex; flex-direction:column; align-items:flex-start; justify-content:space-between; }\n' +
    '.ea-badge { display:inline-block; background:#000; color:#fff; font-weight:900; font-size:22px; padding:0 8px; margin-left:4px; line-height:1.3; }\n' +
    '.sub-bar { display:flex; justify-content:space-between; border:1px solid #000; border-top:none; padding:4px 8px; font-size:8.5px; background:#f5f5f5; }\n' +
    '.notice { border:1.5px solid #000; border-top:none; padding:5px 8px; font-size:8px; font-weight:700; text-align:center; background:#FFFDE7; margin-bottom:4px; }\n' +
    '/* Section headers */\n' +
    '.sh { background:#e0e0e0; border:1px solid #999; padding:3px 6px; font-weight:700; font-size:9px; margin-top:5px; margin-bottom:0; border-bottom:none; }\n' +
    '.sh-sub { border:1px solid #999; border-top:none; padding:2px 6px; font-size:8px; font-style:italic; background:#fafafa; border-bottom:none; }\n' +
    '/* Main income table */\n' +
    'table.main { width:100%; border-collapse:collapse; border:1px solid #999; }\n' +
    'table.main td { vertical-align:top; }\n' +
    'td.lbl { padding:2.5px 6px; border-bottom:1px solid #e0e0e0; font-size:8.5px; width:78%; }\n' +
    'td.amt { padding:2.5px 6px; border-bottom:1px solid #e0e0e0; border-left:1.5px solid #999; text-align:right; width:22%; font-size:9px; }\n' +
    'td.amt .amt-val { font-family:Courier New,monospace; font-weight:700; }\n' +
    'td.bold, td.amt.bold { font-weight:700; background:#f5f5f5; border-top:1.5px solid #999; }\n' +
    '.sec-row { padding:3px 6px; font-size:8.5px; font-weight:700; background:#f0f0f0; }\n' +
    '/* RM header */\n' +
    '.rm-hdr { display:flex; justify-content:flex-end; border:1px solid #999; border-top:none; border-bottom:none; padding-right:6px; font-weight:700; font-size:9px; background:#f9f9f9; }\n' +
    '/* Section A grid */\n' +
    'table.sa { width:100%; border-collapse:collapse; border:1px solid #999; font-size:8.5px; }\n' +
    'table.sa td { padding:3px 6px; border-bottom:1px dotted #ccc; vertical-align:top; }\n' +
    'table.sa td.lb { color:#444; width:26%; min-width:90px; }\n' +
    'table.sa td.vl { font-weight:700; color:#000; }\n' +
    'table.sa td.sep { border-left:1px solid #ccc; }\n' +
    '/* Total row */\n' +
    '.tot-row { display:flex; justify-content:space-between; border:1.5px solid #999; border-top:2px solid #555; padding:4px 8px; font-weight:700; font-size:10px; margin-top:1px; background:#f0f0f0; }\n' +
    '/* Section E/F inline */\n' +
    '.ef-row { display:flex; justify-content:space-between; align-items:baseline; border:1px solid #999; border-top:none; padding:3px 8px; font-size:8.5px; }\n' +
    '.ef-row .rv { font-family:Courier New,monospace; font-weight:700; min-width:80px; text-align:right; }\n' +
    '/* Footer */\n' +
    '.footer-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; border-top:1.5px solid #999; padding-top:8px; font-size:8.5px; }\n' +
    '.fline { display:flex; margin-bottom:4px; }\n' +
    '.fline .fl { color:#555; min-width:100px; }\n' +
    '.fline .fv { font-weight:700; border-bottom:1px dotted #aaa; flex:1; padding-left:4px; }\n' +
    '.fn { font-size:7.5px; color:#666; text-align:center; margin-top:8px; border-top:1px solid #ccc; padding-top:5px; }\n' +
    '@media print { body { background:#fff; padding:0; } .print-btn { display:none; } .page { border:none; box-shadow:none; margin:0; padding:8mm; width:100%; } }\n' +
    '</style>\n</head>\n<body>\n' +
    '<button class="print-btn" onclick="window.print()">&#128438; Print / Save as PDF</button>\n' +
    '<div class="page">\n' +

    // ── HEADER ──────────────────────────────────────────────────────
    '<div class="hdr">\n' +
    '  <div class="hdr-left" style="display:flex;align-items:center;gap:8px;">\n' +
    '    <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAEHAYEDASIAAhEBAxEB/8QAHQABAAEEAwEAAAAAAAAAAAAAAAcBBAYIAgMFCf/EAFAQAAEDAwIDBQQFBwYJDQAAAAEAAgMEBREGBxIhMQgTQVFhFCIycRUjgZGhFjNCVZKx8CQ1UnLB0RclJzRidKKy0gk2NzhFU3N1goSU4fH/xAAcAQEAAQUBAQAAAAAAAAAAAAAAAQIDBAUGBwj/xAA6EQACAQMDAgMFBQcDBQAAAAAAAQIDBBEFITEGEhNBURQiMmGxByNSgaEVRFRxkcHRFmLhJDRC8PH/2gAMAwEAAhEDEQA/ANy0REAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREBxbJG5xa2RpIOCAei5LrEbWuJAAJPXC5Dy6q3CUnygckQoq8gIiKQEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAwmERRuAiIpAREQBERAEREAREQBERAEVHHAXH3vNR3LOAc0XXxOBwvFuGpqGku0Vte4mWQ4yOgVudaNOPdLYlJvg95FaMrIXVBpxOwy4z3efewrnJ81c7tu7yIOSKjVVSEEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEymVCeQUecNVOgVXHAXmX26Q2yhfPK4A493n1VqrWhSj3S4JUcssdY36Kz0LiHA1DxhjVHD546KCW93Qh0rgSxrj4+C75J3XCqkvd0dimjJLA4qHd29ccQma2QcAyGMysjp/Ra2v3SlJNU1+pFWoqSwY3rXdm+6f3CpL/R1TpHMdiWF7iWvZkciPsW2+2eubRrvTFPerXOwteAJYs+9G7yK+cN7nmuVaZ5CXZ/SWb7HbgXTbXU8NU1zpbVUkNqYc8iOnF6H+5eydS9F0LjT6btl2ziuPX5Gvo3D73ng+i0ecc1yXjaUv1v1BZae622Zs9PUMDmuB6cuh9QvWbKHYwDz6LxjDTcZLDXKNgnlZOaKmVUc1ICIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCHoiEgDJRvAKFD0TiGF1yyNY0ucQGgZJKoyo+8ScK2phpqZ00zgGNGTlRjd6x+obm58knd0VOcjyKvNV3We8Vxt9I/hgBw9w6KP9xdT0lnt7rbRvaAxv1jmnqVrrO1r67dqhR+FPclzVOOTxN19YwU8T6WndwQMGOEeJC1uv1znu9e9zieHPIK91lf5brWljHuLcnxXHStmqLncqahponSSzuAbgevVfSGj6dR0OyWyTS5/9waqrKVaWxlOy+20ustQRQzNe2gh96okA/Aeqmy/dn/QzqZ0tPWVVuDRnidJxNz581mumLbbNvNCsZP3cLWMElTJnBc7Gev3rXTdrcu66or5YKSokpLbG7hayN2C8eq8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" style="width:52px;height:52px;object-fit:contain;flex-shrink:0;" alt="LHDN">\n' +
    '    <div>\n' +
    '      <div><b>'+T.cp+'</b></div>\n' +
    '      <div style="font-weight:700;font-size:11px;margin-top:2px;">'+T.tag+'</div>\n' +
    '      <div style="font-weight:700;font-size:12px;letter-spacing:1px;margin-top:1px;">'+T.tax+'</div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="hdr-mid">\n' +
    '    <div style="font-weight:700;font-size:10px;line-height:1.4;">'+T.title+'</div>\n' +
    '    <div style="font-size:9px;margin-top:2px;">'+T.yr+'</div>\n' +
    '  </div>\n' +
    '  <div class="hdr-right">\n' +
    '    <div style="font-size:9px;">'+T.sector+' <span class="ea-badge">EA</span></div>\n' +
    '    <div style="margin-top:6px;font-size:8.5px;">'+T.tin_ee+'</div>\n' +
    '    <div style="font-weight:700;font-size:9px;border-bottom:1px solid #555;min-width:120px;padding-bottom:2px;">'+( emp.taxNo||emp.nric||"")+'</div>\n' +
    '  </div>\n' +
    '</div>\n' +

    '<div class="sub-bar">\n' +
    '  <span>'+T.sn+': <b>'+(co.serialNo||"_____________")+'</b></span>\n' +
    '  <span>'+T.tin_emp+': <b>'+(co.taxRef||"")+'</b></span>\n' +
    '  <span>'+T.state+': <b>'+(emp.taxBranch||co.state||"")+'</b></span>\n' +
    '</div>\n' +
    '<div class="notice">'+T.notice+'</div>\n' +

    // ── SECTION A ────────────────────────────────────────────────────
    '<div class="sh">'+T.secA+'</div>\n' +
    '<table class="sa">\n' +
    '  <tr><td class="lb">'+T.f1+'</td><td class="vl" colspan="3">'+( emp.name||"")+'</td></tr>\n' +
    '  <tr><td class="lb">'+T.f2+'</td><td class="vl">'+( emp.position||emp.role||"")+'</td><td class="lb sep">'+T.f3+'</td><td class="vl">'+( emp.empNo||"")+'</td></tr>\n' +
    '  <tr><td class="lb">'+T.f4+'</td><td class="vl">'+( emp.nric||"")+'</td><td class="lb sep">'+T.f5+'</td><td class="vl">'+( emp.passport||"")+'</td></tr>\n' +
    '  <tr><td class="lb">'+T.f6+'</td><td class="vl">'+( emp.epfNo||"")+'</td><td class="lb sep">'+T.f7+'</td><td class="vl">'+( emp.socsoNo||"")+'</td></tr>\n' +
    '  <tr>\n' +
    '    <td class="lb" style="vertical-align:top;">'+T.f8+'</td>\n' +
    '    <td class="vl">'+( emp.pcbChildren||0)+'</td>\n' +
    '    <td class="lb sep" colspan="2" style="font-size:8px;line-height:1.7;">'+T.f9+'<br>'+T.f9a+' .....................<br>'+T.f9b+' .....................</td>\n' +
    '  </tr>\n' +
    '</table>\n' +

    // ── SECTION B ────────────────────────────────────────────────────
    '<div class="sh">'+T.secB+'</div>\n' +
    '<div class="sh-sub">'+T.secBsub+'</div>\n' +
    '<div class="rm-hdr">RM</div>\n' +
    '<table class="main">\n' +
    R(T.b1a, d.b1a) +
    R(T.b1b, d.b1b) +
    R(T.b1c, d.b1c) +
    RL(T.b1c2) +
    R(T.b1d, d.b1d) +
    R(T.b1e, d.b1e) +
    R(T.b1f, d.b1f) +
    SEP +
    RL(T.b2) +
    RL(T.b2a) +
    R(T.b2b, d.b2) +
    SEP +
    R(T.b3, d.b3) +
    R(T.b4, d.b4) +
    R(T.b5, d.b5) +
    R(T.b6, d.b6) +
    '</table>\n' +

    // ── SECTION C ────────────────────────────────────────────────────
    '<div class="sh" style="margin-top:5px;">'+T.secC+'</div>\n' +
    '<div class="rm-hdr">RM</div>\n' +
    '<table class="main">\n' +
    R(T.c1, d.c1) +
    R(T.c2, d.c2) +
    '</table>\n' +
    '<div class="tot-row"><span>'+T.total+'</span><span style="font-family:Courier New,monospace;">'+fmtZ(d.grand)+'</span></div>\n' +

    // ── SECTION D ────────────────────────────────────────────────────
    '<div class="sh" style="margin-top:5px;">'+T.secD+'</div>\n' +
    '<div class="rm-hdr">RM</div>\n' +
    '<table class="main">\n' +
    R(T.d1, d.d1) +
    R(T.d2, d.d2 || cp38Total) +
    R(T.d3, d.d3) +
    R(T.d4, d.d4) +
    SEP +
    RL(T.d5) +
    RL(T.d5a) +
    RL(T.d5b) +
    SEP +
    R(T.d6, d.d6) +
    '</table>\n' +

    // ── SECTION E ────────────────────────────────────────────────────
    '<div class="sh" style="margin-top:5px;">'+T.secE+'</div>\n' +
    '<div class="ef-row" style="border-top:1px solid #999;">'+T.e1n+': <b>'+(d.e1_name||"EPF / KWSP")+'</b></div>\n' +
    '<div class="ef-row">'+T.e1a+'<span class="rv">'+fmtZ(d.e1_amt)+'</span></div>\n' +
    '<div class="ef-row">'+T.e2+'<span class="rv">'+fmtZ(d.e2_amt)+'</span></div>\n' +

    // ── SECTION F ────────────────────────────────────────────────────
    '<div class="ef-row" style="border-top:1.5px solid #555;font-weight:700;font-size:9px;margin-top:3px;background:#f5f5f5;">'+
      '<span>'+T.secF+'</span><span class="rv" style="font-family:Courier New,monospace;">'+fmtZ(d.f_total)+'</span>'+
    '</div>\n' +

    // ── FOOTER ───────────────────────────────────────────────────────
    '<div class="footer-grid">\n' +
    '  <div>\n' +
    '    <div class="fline"><span class="fl">'+T.off+'</span><span class="fv">'+(co.hrOfficer||"")+'</span></div>\n' +
    '    <div class="fline"><span class="fl">'+T.des+'</span><span class="fv">'+(co.hrDesig||"HR Executive")+'</span></div>\n' +
    '    <div class="fline"><span class="fl">'+T.addr+'</span><span class="fv">'+(co.name||"")+'</span></div>\n' +
    addrArr.map(function(a){ return '    <div class="fline"><span class="fl"></span><span class="fv">'+a+'</span></div>\n'; }).join("") +
    '    <div class="fline"><span class="fl">'+T.ph+'</span><span class="fv">'+(co.phone||co.tel||"")+'</span></div>\n' +
    '  </div>\n' +
    '  <div style="display:flex;flex-direction:column;align-items:flex-start;gap:16px;">\n' +
    '    <div class="fline" style="width:100%;"><span class="fl">'+T.dt+'</span><span class="fv">'+dateStr+'</span></div>\n' +
    '    <div style="margin-top:20px;border-top:1px solid #555;width:160px;padding-top:4px;font-size:8px;color:#555;">Signature / Tandatangan Majikan</div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '<div class="fn">'+T.cp+' | Issued pursuant to s83(1A) Income Tax Act 1967. Retain this form for your personal income tax filing.</div>\n' +
    '</div>\n</body>\n</html>';

  var blob = new Blob([html], { type: "text/html;charset=utf-8" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href   = url;
  a.download = "BorangEA_"+yr+"_"+(emp.name||"").replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_]/g,"")+".html";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
}

// ── EAPreview: renders Borang EA inline inside the app ───────────────────────
function EAPreview(p) {
  var d   = p.data || {};
  var BM  = p.lang === "BM";
  var co  = p.co   || {};
  var emp = d.emp  || {};
  var yr  = d.yr   || 2025;
  var fmt = function(v){ return parseFloat(v||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); };
  var today = new Date();
  var dateStr = String(today.getDate()).padStart(2,"0")+"/"+String(today.getMonth()+1).padStart(2,"0")+"/"+today.getFullYear();
  var addrArr = [co.addr1,co.addr2,((co.postcode||"")+" "+(co.city||"")).trim(),co.state].map(function(x){return (x||"").trim();}).filter(Boolean);

  var T = {
    cp:"(C.P. 8A - Pin. 2024)",
    tax:   BM?"CUKAI PENDAPATAN":"INCOME TAX",
    prvt:  BM?"Penyata Gaji Pekerja SWASTA":"PRIVATE SECTOR Employee's Statement of Remuneration",
    stmt:  BM?"PENYATA SARAAN DARIPADA PENGGAJIAN":"STATEMENT OF REMUNERATION FROM EMPLOYMENT",
    yr:    BM?"BAGI TAHUN BERAKHIR 31 DISEMBER "+yr:"FOR THE YEAR ENDED 31 DECEMBER "+yr,
    sn:    BM?"No. Siri":"Serial No.",
    tinE:  BM?"TIN Majikan E":"Employer's TIN E",
    tinEe: BM?"No. Pengenalan Cukai (TIN) Pekerja":"Employee's Tax Identification No. (TIN)",
    state: BM?"LHDNM Negeri":"LHDNM State",
    notice:BM?"BORANG EA INI PERLU DISEDIAKAN UNTUK DISERAHKAN KEPADA PEKERJA BAGI TUJUAN CUKAI PENDAPATANNYA":"THIS FORM EA MUST BE PREPARED AND PROVIDED TO THE EMPLOYEE FOR INCOME TAX PURPOSE",
    secA:  BM?"BUTIRAN PEKERJA":"PARTICULARS OF EMPLOYEE",
    f1:BM?"1. Nama Penuh Pekerja/Pesara (En./Cik/Puan)":"1. Full Name of Employee / Pensioner (Mr./Miss/Madam)",
    f2:BM?"2. Jawatan":"2. Job Designation",
    f3:BM?"3. No. Kakitangan / No. Gaji":"3. Staff No. / Payroll No.",
    f4:BM?"4. No. K.P. Baru":"4. New I.C. No",
    f5:BM?"5. No. Pasport":"5. Passport No.",
    f6:BM?"6. No. KWSP":"6. EPF No.",
    f7:BM?"7. No. PERKESO":"7. SOCSO No.",
    f8a:BM?"8. Bilangan anak yang layak":"8. Number of children",
    f8b:BM?"untuk pelepasan cukai":"qualified for tax relief",
    f9: BM?"9. Jika bekerja tidak genap setahun, nyatakan:":"9. If the period of employment is less than a year, please state:",
    f9a:BM?"(a) Tarikh mula bekerja":"(a) Date of commencement",
    f9b:BM?"(b) Tarikh berhenti kerja":"(b) Date of cessation",
    secB:BM?"PENDAPATAN PENGGAJIAN, MANFAAT DAN TEMPAT KEDIAMAN":"EMPLOYMENT INCOME, BENEFITS AND LIVING ACCOMMODATION",
    secBs:BM?"(Tidak Termasuk Elaun/Perkuisit/Pemberian/Manfaat Yang Dikecualikan Cukai)":"(Excluding Tax Exempt Allowances / Perquisites / Gifts / Benefits)",
    b1a:BM?"1. (a) Gaji kasar, upah atau gaji cuti (termasuk gaji lebih masa)":"1. (a) Gross salary, wages or leave pay (including overtime pay)",
    b1b:BM?"    (b) Fi (termasuk fi pengarah), komisen atau bonus":"    (b) Fees (including director fees), commission or bonus",
    b1c:BM?"    (c) Tip kasar, perkuisit, penerimaan sagu hati atau elaun-elaun lain (Perihal pembayaran: ..................)":"    (c) Gross tips, perquisites, awards / rewards or other allowances (Details of payment: ..................)",
    b1d:BM?"    (d) Cukai pendapatan yang dibayar oleh majikan bagi pihak pekerja":"    (d) Income tax borne by the employer in respect of his employee",
    b1e:BM?"    (e) Manfaat Skim Opsyen Saham Pekerja (ESOS)":"    (e) Employee Share Option Scheme (ESOS) benefit",
    b1f:BM?"    (f) Ganjaran bagi tempoh dari ............... hingga ...............":"    (f) Gratuity for the period from ............... to ...............",
    b2h:BM?"2. Butiran bayaran tunggakan dan lain-lain bagi tahun-tahun terdahulu dalam tahun semasa":"2. Details of arrears and others for preceding years paid in the current year",
    b2a:BM?"    Jenis pendapatan  (a) ..........................":"    Type of income  (a) ..........................",
    b2b:"                          (b) ..........................",
    b3: BM?"3. Manfaat berupa barangan (Nyatakan: .................................................................)":"3. Benefits in kind (Specify: .................................................................)",
    b4: BM?"4. Nilai tempat kediaman (Alamat: ..........................................................................)":"4. Value of living accommodation provided (Address: ..........................................................................)",
    b5: BM?"5. Bayaran balik daripada Kumpulan Wang Simpanan / Pencen yang tidak diluluskan":"5. Refund from unapproved Provident / Pension Fund",
    b6: BM?"6. Pampasan kerana kehilangan pekerjaan":"6. Compensation for loss of employment",
    secC:BM?"PENCEN DAN LAIN-LAIN":"PENSION AND OTHERS",
    total:BM?"JUMLAH":"TOTAL",
    c1:BM?"1. Pencen":"1. Pension",
    c2:BM?"2. Anuiti atau bayaran berkala yang lain":"2. Annuities or other periodical payments",
    secD:BM?"JUMLAH POTONGAN":"TOTAL DEDUCTION",
    d1:BM?"1. Potongan cukai bulanan (PCB) yang dibayar kepada LHDNM":"1. Monthly tax deductions (MTD) remitted to LHDNM",
    d2:BM?"2. Arahan potongan CP38 yang dibayar kepada LHDNM":"2. CP38 deductions remitted to LHDNM",
    d3:BM?"3. Zakat yang dibayar melalui potongan gaji":"3. Zakat paid via salary deduction",
    d4:BM?"4. Derma / hadiah / sumbangan diluluskan yang dibayar melalui potongan gaji":"4. Approved donations / gifts / contributions via salary deduction",
    d5h:BM?"5. Jumlah tuntutan potongan oleh pekerja melalui Borang TP1 berkaitan:":"5. Total claim for deduction by employee via Form TP1 in respect of:",
    d5a:BM?"    (a) Pelepasan  RM ..................................":"    (a) Relief  RM ..................................",
    d5b:BM?"    (b) Zakat selain yang dibayar melalui potongan gaji bulanan  RM ..................................":"    (b) Zakat other than that paid via monthly salary deduction  RM ..................................",
    d6:BM?"6. Jumlah pelepasan bagi anak yang layak":"6. Total qualifying child relief",
    secE:BM?"CARUMAN YANG DIBAYAR OLEH PEKERJA KEPADA KUMPULAN WANG SIMPANAN / PENCEN YANG DILULUSKAN DAN PERKESO":"CONTRIBUTIONS PAID BY EMPLOYEE TO APPROVED PROVIDENT / PENSION FUND AND SOCSO",
    e1n:BM?"1. Nama Kumpulan wang":"1. Name of Provident Fund",
    e1a:BM?"    Amaun caruman yang wajib dibayar (nyatakan bahagian pekerja sahaja)":"    Amount of compulsory contribution paid (state the employee's share of contribution only)",
    e2: BM?"2. PERKESO : Amaun caruman yang wajib dibayar (nyatakan bahagian pekerja sahaja)":"2. SOCSO: Amount of compulsory contribution paid (state the employee's share of contribution only)",
    secF:BM?"JUMLAH ELAUN / PERKUISIT / PEMBERIAN / MANFAAT YANG DIKECUALIKAN CUKAI":"TOTAL TAX EXEMPT ALLOWANCES / PERQUISITES / GIFTS / BENEFITS",
    fOff:BM?"Nama Pegawai":"Name of Officer",
    fDes:BM?"Jawatan":"Designation",
    fAddr:BM?"Nama dan Alamat Majikan":"Name and Address of Employer",
    fPh:BM?"No. Telefon Majikan":"Employer's Telephone No.",
    fDt:BM?"Tarikh":"Date",
  };

  var bdr  = "1px solid #bbb";
  var bdrB = "1px solid #888";
  var bdrT = "2px solid #000";
  var SH   = {background:"#d4d4d4",fontWeight:700,fontSize:9,padding:"3px 6px",border:bdr,borderBottom:"none",marginTop:5,letterSpacing:0.2};
  var TD   = {fontSize:9,padding:"2px 5px",border:bdr,verticalAlign:"middle"};
  var TDLBL= Object.assign({},TD,{width:"77%"});
  var TDAMT= Object.assign({},TD,{width:"23%",textAlign:"right",fontFamily:"monospace",whiteSpace:"nowrap",borderLeft:"1px dotted #aaa"});
  var TDTOT= Object.assign({},TDAMT,{borderTop:bdrT,fontWeight:700,fontSize:10});

  function BRow(lbl,val) {
    return (
      <tr>
        <td style={TDLBL}>{lbl}</td>
        <td style={TDAMT}>{fmt(val)}</td>
      </tr>
    );
  }
  function BLbl(lbl) {
    return <tr><td style={Object.assign({},TDLBL,{width:"100%"})} colSpan={2}>{lbl}</td></tr>;
  }

  return (
    <div style={{fontFamily:"Arial,Helvetica,sans-serif",fontSize:9.5,color:"#000",background:"#fff",padding:"16px 20px",minWidth:600}}>

      {/* ── Header ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:3}}>
        <div style={{fontSize:8,minWidth:160}}>
          <div>{T.cp}</div>
          <div style={{fontWeight:700}}>MALAYSIA</div>
          <div style={{fontWeight:700}}>{T.tax}</div>
        </div>
        <div style={{flex:1,textAlign:"center"}}>
          <div style={{fontSize:9,fontWeight:700}}>{T.stmt}</div>
          <div style={{fontSize:8.5,fontWeight:700}}>{T.yr}</div>
        </div>
        <div style={{textAlign:"right",minWidth:180,fontSize:8}}>
          <div>{T.prvt} <span style={{border:"2px solid #000",padding:"1px 6px",fontSize:17,fontWeight:900,display:"inline-block"}}>EA</span></div>
          <div style={{marginTop:3}}>{T.tinEe}</div>
          <div style={{fontWeight:700,fontSize:9}}>{emp.taxNo||emp.nric||""}</div>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",fontSize:8,marginBottom:3}}>
        <span>{T.sn}: <b>{co.serialNo||""}</b> ................</span>
        <span>{T.tinE}: <b>{co.taxRef||""}</b> ................</span>
        <span>{T.state}: <b>{emp.taxBranch||co.state||""}</b></span>
      </div>

      <div style={{background:"#000",color:"#fff",fontWeight:700,fontSize:8,textAlign:"center",padding:"4px 6px",marginBottom:7}}>{T.notice}</div>

      {/* ── Section A ── */}
      <div style={SH}>A &nbsp; {T.secA}</div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <tbody>
          <tr>
            <td style={Object.assign({},TD,{width:"22%",fontSize:8.5})}>{T.f1}</td>
            <td style={Object.assign({},TD,{fontWeight:700})} colSpan={3}>{emp.name||""}</td>
          </tr>
          <tr>
            <td style={Object.assign({},TD,{fontSize:8.5})}>{T.f2}</td>
            <td style={TD}>{emp.position||emp.role||""}</td>
            <td style={Object.assign({},TD,{fontSize:8.5})}>{T.f3}</td>
            <td style={TD}>{emp.empNo||""}</td>
          </tr>
          <tr>
            <td style={Object.assign({},TD,{fontSize:8.5})}>{T.f4}</td>
            <td style={TD}>{emp.nric||""}</td>
            <td style={Object.assign({},TD,{fontSize:8.5})}>{T.f5}</td>
            <td style={TD}>{emp.passport||""}</td>
          </tr>
          <tr>
            <td style={Object.assign({},TD,{fontSize:8.5})}>{T.f6}</td>
            <td style={TD}>{emp.epfNo||""}</td>
            <td style={Object.assign({},TD,{fontSize:8.5})}>{T.f7}</td>
            <td style={TD}>{emp.socsoNo||""}</td>
          </tr>
          <tr>
            <td style={Object.assign({},TD,{fontSize:8.5,verticalAlign:"top"})}>{T.f8a}<br/><span style={{fontSize:8}}>{T.f8b}</span></td>
            <td style={TD}>{emp.pcbChildren||emp.children||0}</td>
            <td style={Object.assign({},TD,{fontSize:8.5,lineHeight:1.8})} colSpan={2}>
              {T.f9}<br/>{T.f9a} .......................<br/>{T.f9b} .......................
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Section B ── */}
      <div style={SH}>B &nbsp; {T.secB} <span style={{float:"right",fontWeight:400,fontSize:8}}>{T.secBs}</span></div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr>
            <td style={Object.assign({},TDLBL,{borderBottom:bdrB})}></td>
            <td style={Object.assign({},TDAMT,{fontWeight:700,borderBottom:bdrB,borderLeft:bdr})}>RM</td>
          </tr>
        </thead>
        <tbody>
          {BRow(T.b1a,d.b1a)}{BRow(T.b1b,d.b1b)}{BRow(T.b1c,d.b1c)}
          {BRow(T.b1d,d.b1d)}{BRow(T.b1e,d.b1e)}{BRow(T.b1f,d.b1f)}
          {BLbl(T.b2h)}{BLbl(T.b2a)}{BRow(T.b2b,d.b2)}
          {BRow(T.b3,d.b3)}{BRow(T.b4,d.b4)}{BRow(T.b5,d.b5)}{BRow(T.b6,d.b6)}
        </tbody>
      </table>

      {/* ── Section C ── */}
      <div style={SH}>C &nbsp; {T.secC} <span style={{float:"right"}}>{T.total}</span></div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <tbody>
          {BRow(T.c1,d.c1)}{BRow(T.c2,d.c2)}
          <tr><td style={Object.assign({},TDLBL,{borderTop:bdrT,fontWeight:700,fontSize:10})}>{T.total}</td><td style={TDTOT}>{fmt(d.grand)}</td></tr>
        </tbody>
      </table>

      {/* ── Section D ── */}
      <div style={SH}>D &nbsp; {T.secD}</div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <tbody>
          {BRow(T.d1,d.d1)}{BRow(T.d2,d.d2)}{BRow(T.d3,d.d3)}{BRow(T.d4,d.d4)}
          {BLbl(T.d5h)}{BRow(T.d5a,d.d5a)}{BRow(T.d5b,d.d5b)}{BRow(T.d6,d.d6)}
        </tbody>
      </table>

      {/* ── Section E ── */}
      <div style={SH}>E &nbsp; {T.secE}</div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"2px 5px",border:bdr,fontSize:9}}>
        <span>{T.e1n} &nbsp; <b>{d.e1_name||"EPF"}</b> ..................................</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"2px 5px",border:bdr,borderTop:"none",fontSize:9}}>
        <span>{T.e1a}</span><span style={{fontFamily:"monospace",fontWeight:700}}>RM &nbsp;{fmt(d.e1_amt)}</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"2px 5px",border:bdr,borderTop:"none",fontSize:9}}>
        <span>{T.e2}</span><span style={{fontFamily:"monospace",fontWeight:700}}>RM &nbsp;{fmt(d.e2_amt)}</span>
      </div>

      {/* ── Section F ── */}
      <div style={{display:"flex",justifyContent:"space-between",padding:"3px 5px",border:"1px solid #999",fontWeight:700,fontSize:9,marginTop:5}}>
        <span>F &nbsp; {T.secF}</span>
        <span>RM &nbsp;<span style={{fontFamily:"monospace"}}>{fmt(d.f_total)}</span></span>
      </div>

      {/* ── Footer ── */}
      <div style={{display:"flex",gap:0,marginTop:16,borderTop:"1px solid #aaa",paddingTop:8,fontSize:8.5}}>
        <div style={{width:140,flexShrink:0,borderRight:"1px solid #ccc",paddingRight:12}}>
          <div style={{display:"flex",gap:6,padding:"2px 0",borderBottom:"1px dotted #ccc"}}>
            <span style={{minWidth:60,color:"#444"}}>{T.fDt}</span>
            <span style={{fontWeight:600}}>{dateStr}</span>
          </div>
        </div>
        <div style={{flex:1,paddingLeft:12}}>
          {[
            [T.fOff,  co.hrOfficer||"HR Officer"],
            [T.fDes,  co.hrDesig||"HR Executive"],
            [T.fAddr, co.name||""],
          ].concat(addrArr.map(function(a){return ["",a];})).concat([
            [T.fPh, co.phone||co.tel||""],
          ]).map(function(row,i){
            return (
              <div key={i} style={{display:"flex",gap:6,padding:"2px 0",borderBottom:"1px dotted #ccc"}}>
                <span style={{minWidth:110,color:"#444"}}>{row[0]}</span>
                <span style={{fontWeight:600}}>{row[1]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{fontSize:7.5,color:"#777",textAlign:"center",marginTop:8,borderTop:"1px solid #eee",paddingTop:6}}>
        {T.cp} &nbsp;|&nbsp; {BM?"Borang ini dikeluarkan mengikut seksyen 83(1A) Akta Cukai Pendapatan 1967.":"Issued pursuant to s83(1A) Income Tax Act 1967. Please retain for your tax records."}
      </div>
    </div>
  );
}






// ── generateFormEHTML — Official LHDN Form E (CP8 Pin.2025) — exact replica ──
function generateFormEHTML(employees, co, yr) {
  yr = yr || 2025;
  co = co || {};
  var rows = employees.map(function(e){ return computeRow(e,26,{}); });

  var fmt = function(v){ var n=parseFloat(v||0); return n===0?"":n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); };
  var fmtZ = function(v){ return parseFloat(v||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); };
  var today = new Date();
  var dd = String(today.getDate()).padStart(2,"0"), mm = String(today.getMonth()+1).padStart(2,"0"), yy = today.getFullYear();
  var dateStr = dd+"/"+mm+"/"+yy;

  var totalEmp = employees.length;
  var totalMTD = employees.filter(function(e){ return (e.pcb||0)>0; }).length || totalEmp;
  var newEmp   = employees.filter(function(e){ return e.joinDate && e.joinDate.slice(0,4)===String(yr); }).length;
  var cessEmp  = employees.filter(function(e){ return e.endDate  && e.endDate.slice(0,4)===String(yr); }).length;

  var tGross = rows.reduce(function(s,r){return s+(r.grossTotal||0)*12;},0);
  var tPCB   = rows.reduce(function(s,r){return s+(r.pcb||0)*12;},0);
  var tEPF   = rows.reduce(function(s,r){return s+(r.epfEe||0)*12;},0);
  var tSocso = rows.reduce(function(s,r){return s+(r.socsoEe||0)*12;},0);

  // C.P.8D rows — exact 22 columns per official CP8D-Pin.2025 spec
  var na = function(v){ return (v===undefined||v===null||v===""||v===0)?"n/a":v; };
  var naNum = function(v){ var n=parseFloat(v||0); return n===0?"n/a":n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); };
  var cpRows = employees.map(function(e,i){
    var r          = rows[i]||{};
    var gross      = (r.grossTotal||0)*12;
    var pcb        = (r.pcb||0)*12;
    var epf        = (r.epfEe||0)*12;
    var socso      = (r.socsoEe||0)*12;
    var medIns     = parseFloat(e.medicalInsurance)||0;
    var cp38       = (e.cp38Amount||0)*12;
    var childRel   = calcChildRelief(e.childrenDetails||[]) || ((parseInt(e.pcbChildren)||0)*2000);
    var numChild   = (e.childrenDetails||[]).length || parseInt(e.pcbChildren)||0;
    var travelAnn  = (r.travel||0)*12;
    var exempt     = Math.min(travelAnn,6000);
    var totRelief  = 9000 + childRel;
    var cat        = e.spouseRelief ? "2" : "1";
    var cessDate   = e.endDate||"";
    // Tax borne: 1=Yes (employer pays tax) 2=No. Default No unless flag set.
    var taxBorne   = e.taxBorneByEmployer ? "1" : "2";
    // Employee status: default Permanent (2), override if part-time/contract
    var empStatus  = e.empType==="Contract"?"3":e.empType==="Part Time"?"4":"2";
    return { name:e.name||"n/a", tin:e.taxNo||"n/a", ic:e.nric||"n/a",
             cat, status:empStatus, retDate:cessDate||"n/a", taxBorne,
             gross, bik:0, living:0, esos:0, exempt,
             medIns, socso, numChild, totRelief, childRel, tp1rel:totRelief,
             zakatOther:0, zakatSal:0, epf, pcb, cp38 };
  });

  /* ════════════════════════════════════════════════════════════════
     CSS — exact LHDN paper look
  ════════════════════════════════════════════════════════════════ */
  var css = `
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#c8c8c8; font-family:Arial,Helvetica,sans-serif; font-size:9px; padding:12px; color:#000; }
.print-btn { background:#B91C1C; color:#fff; border:none; padding:9px 24px; border-radius:6px;
  cursor:pointer; font-size:12px; font-weight:700; margin-bottom:14px; display:inline-block; }

/* ── PORTRAIT pages (1 & 2) — A4 210×297mm ── */
.page { background:#fff; width:210mm; min-height:295mm; margin:0 auto 24px; padding:10mm 14mm;
  border:1px solid #888; box-shadow:0 3px 12px rgba(0,0,0,.35); }

/* ── LANDSCAPE page (3 — CP8D) — A4 rotated 297×210mm ── */
.page-land { background:#fff; width:297mm; min-height:208mm; margin:0 auto 24px; padding:6mm 8mm;
  border:1px solid #888; box-shadow:0 3px 12px rgba(0,0,0,.35); }

/* ── LHDN letterhead ── */
.lhdn-hdr { display:flex; align-items:center; gap:10px; padding-bottom:6px;
  border-bottom:2.5px solid #000; margin-bottom:8px; }
.lhdn-text { flex:1; text-align:center; line-height:1.45; }
.lhdn-text .t1 { font-weight:700; font-size:10px; letter-spacing:.4px; }
.lhdn-text .t2 { font-size:8.5px; }
.lhdn-text .t3 { font-size:8px; }
.form-badge { text-align:right; flex-shrink:0; width:90px; }
.form-badge .fb-form { font-size:9px; }
.form-badge .fb-e    { font-size:54px; font-weight:900; line-height:.9; }
.form-badge .fb-yr   { display:inline-block; border:2px solid #000; font-size:20px;
  font-weight:900; padding:0 5px; line-height:1.3; }
.form-badge .fb-pin  { font-size:8px; margin-top:2px; }

/* ── Page 1 field blocks ── */
.items-outer { border:1.5px solid #000; margin-bottom:8px; }
.items-title { background:#d4d4d4; text-align:center; font-weight:700; font-size:10px;
  padding:4px 0; border-bottom:1.5px solid #000; }
.field-block { display:flex; border-bottom:1px solid #bbb; min-height:22px; }
.fl  { padding:3px 6px; font-size:8.5px; color:#222; min-width:200px; display:flex; align-items:center; }
.fc  { padding:3px 4px; font-size:8.5px; }
.fv  { padding:3px 6px; font-size:9px; font-weight:700; flex:1; display:flex; align-items:center; }
.sub-note { font-size:7.5px; color:#555; font-style:italic; }
.tin-e { display:inline-block; border:1.5px solid #000; padding:1px 5px; font-weight:700;
  font-size:10px; margin-right:4px; }
.addr-grid { display:grid; grid-template-columns:120px 1fr 120px 1fr; gap:0;
  border-top:1px dotted #bbb; padding:3px 6px; font-size:8.5px; }
.ag-lbl { color:#555; }
.ag-val { font-weight:700; border-bottom:1px solid #aaa; padding-left:4px; }
.big-title { border:2px solid #000; text-align:center; margin-bottom:8px; padding:8px 0 4px; }
.big-title .bt1 { font-size:24px; font-weight:900; letter-spacing:2px; }
.big-title .bt2 { font-size:11px; font-weight:700; letter-spacing:1px; }
.reminder-outer { border:1.5px solid #000; margin-bottom:8px; }
.reminder-title  { background:#000; color:#fff; font-weight:700; font-size:10px;
  text-align:center; padding:5px; }
.reminder-body   { padding:8px 12px; font-size:8px; line-height:1.75; }
.reminder-body ol { padding-left:14px; }
.reminder-body ol > li { margin-bottom:4px; }
.reminder-body ol ol { padding-left:12px; margin-top:3px; }
.reminder-body ol ol li { list-style-type:lower-alpha; }
.office-use { border:1.5px solid #000; display:flex; height:52px; margin-bottom:6px; }
.ou-cell { flex:1; border-right:1.5px solid #000; display:flex; align-items:flex-end;
  padding:4px 6px; font-size:8px; color:#555; }
.ou-cell:last-child { border-right:none; }

/* ── Page 2 ── */
.sec-title { background:#d8d8d8; border:1.5px solid #000; text-align:center; font-weight:700;
  font-size:11px; letter-spacing:1px; padding:5px; margin-bottom:4px; }
table.bp { width:100%; border-collapse:collapse; border:1.5px solid #000; font-size:8.5px; margin-bottom:5px; }
table.bp td { border:1px solid #bbb; padding:4px 6px; vertical-align:middle; }
table.bp td.n  { background:#e0e0e0; font-weight:700; text-align:center; width:26px; }
table.bp td.lb { color:#444; }
table.bp td.vl { font-weight:700; }
table.bp td.sm { font-size:7.5px; color:#666; }
.part-bar { background:#000; color:#fff; font-weight:700; font-size:9px;
  letter-spacing:.5px; padding:4px 8px; margin:6px 0 2px; }
.pA { display:grid; grid-template-columns:1fr 1fr; border:1.5px solid #aaa; font-size:8.5px; }
.pA-cell { border:1px solid #ddd; padding:4px 8px; }
.pA-lbl { color:#555; font-size:8px; margin-bottom:2px; }
.pA-val { font-weight:700; font-size:12px; }
.pA-opt { font-size:8px; color:#666; margin-top:2px; }
.part-b { border:1.5px solid #aaa; font-size:8.5px; padding:6px 8px; }
.pb-row { display:flex; margin-bottom:4px; align-items:baseline; gap:4px; }
.pb-lbl { min-width:180px; color:#555; }
.pb-val { border-bottom:1px solid #aaa; flex:1; padding-left:4px; font-weight:700; min-height:14px; }
.decl { border:1.5px solid #000; padding:8px 10px; margin-top:5px; font-size:8.5px; }
.decl-row { display:flex; gap:10px; margin-top:12px; }
.decl-cell { flex:1; border-top:1.5px solid #555; padding-top:4px; font-size:8px; color:#555; }

/* ── Page 3 (CP8D landscape) ── */
.cp8d-employer { border:1.5px solid #aaa; padding:4px 8px; font-size:8px; margin-bottom:4px; background:#fafafa; }
.cp8d-notes { font-size:7px; color:#333; margin-bottom:4px; line-height:1.5; }
table.cp8d { border-collapse:collapse; font-size:6.5px; white-space:nowrap; width:100%; }
table.cp8d th { background:#1a1a4e; color:#fff; border:1px solid #3a3a8e;
  padding:2px 3px; text-align:center; vertical-align:bottom; font-size:6px; line-height:1.3; }
table.cp8d th.grp { background:#2a2a6e; }
table.cp8d td { border:1px solid #ccc; padding:2px 3px; vertical-align:middle; font-size:6.5px; }
table.cp8d td.r { text-align:right; font-family:'Courier New',monospace; }
table.cp8d td.c { text-align:center; }
table.cp8d td.na { text-align:center; color:#999; font-size:6px; }
table.cp8d tr:nth-child(even) td { background:#f4f7ff; }
table.cp8d tfoot td { background:#dde4f5; font-weight:700; border-top:2px solid #1a1a4e; font-size:6.5px; }

/* ── Print media ── */
@media print {
  body { background:#fff; padding:0; }
  .print-btn { display:none; }
  /* Page 1 & 2: portrait */
  .page { border:none; box-shadow:none; padding:8mm 12mm; width:100%;
    min-height:auto; page-break-after:always; }
  /* Page 3: landscape */
  .page-land { border:none; box-shadow:none; padding:5mm 6mm; width:100%;
    min-height:auto; page-break-after:auto; }
  @page { size:A4 portrait; margin:0; }
  @page landscape { size:A4 landscape; margin:0; }
  .page-land { page: landscape; }
}
`;

  /* ════════════════════════════════════════════════════════════════
     PAGE 1 — Cover (exact LHDN layout order)
  ════════════════════════════════════════════════════════════════ */
  var pg1 = `<div class="page">

  <!-- LHDN Letterhead -->
  <div class="lhdn-hdr">
    <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAEHAYEDASIAAhEBAxEB/8QAHQABAAEEAwEAAAAAAAAAAAAAAAcBBAYIAgMFCf/EAFAQAAEDAwIDBQQFBwYJDQAAAAEAAgMEBREGBxIhMQgTQVFhFCIycRUjgZGhFjNCVZKx8CQ1UnLB0RclJzRidKKy0gk2NzhFU3N1goSU4fH/xAAcAQEAAQUBAQAAAAAAAAAAAAAAAQIDBAUGBwj/xAA6EQACAQMDAgMFBQcDBQAAAAAAAQIDBBEFITEGEhNBURQiMmGxByNSgaEVRFRxkcHRFmLhJDRC8PH/2gAMAwEAAhEDEQA/ANy0REAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREBxbJG5xa2RpIOCAei5LrEbWuJAAJPXC5Dy6q3CUnygckQoq8gIiKQEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAwmERRuAiIpAREQBERAEREAREQBERAEVHHAXH3vNR3LOAc0XXxOBwvFuGpqGku0Vte4mWQ4yOgVudaNOPdLYlJvg95FaMrIXVBpxOwy4z3efewrnJ81c7tu7yIOSKjVVSEEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEymVCeQUecNVOgVXHAXmX26Q2yhfPK4A493n1VqrWhSj3S4JUcssdY36Kz0LiHA1DxhjVHD546KCW93Qh0rgSxrj4+C75J3XCqkvd0dimjJLA4qHd29ccQma2QcAyGMysjp/Ra2v3SlJNU1+pFWoqSwY3rXdm+6f3CpL/R1TpHMdiWF7iWvZkciPsW2+2eubRrvTFPerXOwteAJYs+9G7yK+cN7nmuVaZ5CXZ/SWb7HbgXTbXU8NU1zpbVUkNqYc8iOnF6H+5eydS9F0LjT6btl2ziuPX5Gvo3D73ng+i0ecc1yXjaUv1v1BZae622Zs9PUMDmuB6cuh9QvWbKHYwDz6LxjDTcZLDXKNgnlZOaKmVUc1ICIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCHoiEgDJRvAKFD0TiGF1yyNY0ucQGgZJKoyo+8ScK2phpqZ00zgGNGTlRjd6x+obm58knd0VOcjyKvNV3We8Vxt9I/hgBw9w6KP9xdT0lnt7rbRvaAxv1jmnqVrrO1r67dqhR+FPclzVOOTxN19YwU8T6WndwQMGOEeJC1uv1znu9e9zieHPIK91lf5brWljHuLcnxXHStmqLncqahponSSzuAbgevVfSGj6dR0OyWyTS5/9waqrKVaWxlOy+20ustQRQzNe2gh96okA/Aeqmy/dn/QzqZ0tPWVVuDRnidJxNz581mumLbbNvNCsZP3cLWMElTJnBc7Gev3rXTdrcu66or5YKSokpLbG7hayN2C8eq8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" style="width:52px;height:52px;object-fit:contain;" alt="LHDN Logo">
    <div class="lhdn-text">
      <div class="t1">LEMBAGA HASIL DALAM NEGERI MALAYSIA</div>
      <div class="t2">RETURN FORM OF EMPLOYER</div>
      <div class="t2">UNDER SUBSECTION 83(1) OF THE INCOME TAX ACT 1967</div>
      <div class="t3">This form is prescribed under section 152 of the Income Tax Act 1967</div>
    </div>
    <div class="form-badge">
      <div class="fb-form">Form</div>
      <div class="fb-e">E</div>
      <div><span class="fb-yr">${yr}</span></div>
      <div class="fb-pin">C P 8 - Pin. ${yr}</div>
    </div>
  </div>

  <!-- COMPLETE THE FOLLOWING ITEMS -->
  <div class="items-outer">
    <div class="items-title">COMPLETE THE FOLLOWING ITEMS</div>

    <div class="field-block">
      <span class="fl">Name of employer</span><span class="fc">:</span>
      <span class="fv">${co.name||""}</span>
    </div>

    <div class="field-block" style="align-items:flex-start;min-height:50px;">
      <span class="fl" style="flex-direction:column;align-items:flex-start;padding-top:4px;">
        Reference no.<br>
        <span class="sub-note">( Identification / passport /<br>registration no. * )</span><br>
        <span class="sub-note">[ * Delete whichever is not relevant ]</span>
      </span>
      <span class="fc" style="padding-top:4px;">:</span>
      <span class="fv">${co.regNo||""}</span>
    </div>

    <div class="field-block">
      <span class="fl">Employer's TIN</span>
      <span class="fc">: <span class="tin-e">E</span></span>
      <span class="fv">${co.taxRef||""}</span>
    </div>

    <div class="field-block addr-block">
      <div style="display:flex;min-height:20px;">
        <span class="fl">Correspondence address</span><span class="fc">:</span>
        <span class="fv">${co.addr1||""}</span>
      </div>
      <div style="display:flex;padding-left:206px;min-height:16px;border-top:1px dotted #ccc;">
        <span class="fv">${co.addr2||""}</span>
      </div>
      <div style="display:flex;padding-left:206px;min-height:16px;border-top:1px dotted #ccc;">
        <span class="fv">${(co.postcode||"")+" "+(co.city||"")}</span>
      </div>
      <div class="addr-grid">
        <span class="ag-lbl">Postcode</span><span class="ag-val">${co.postcode||""}</span>
        <span class="ag-lbl">City</span><span class="ag-val">${co.city||""}</span>
      </div>
      <div class="addr-grid" style="border-top:1px dotted #bbb;">
        <span class="ag-lbl">State</span><span class="ag-val">${co.state||""}</span>
        <span class="ag-lbl">Country</span><span class="ag-val">${co.country||"MALAYSIA"}</span>
      </div>
    </div>
  </div>

  <!-- Big Form E title -->
  <div class="big-title">
    <div class="bt1">FORM E ${yr}</div>
    <div class="bt2">EMPLOYER</div>
  </div>

  <!-- Important Reminder -->
  <div class="reminder-outer">
    <div class="reminder-title">IMPORTANT REMINDER</div>
    <div class="reminder-body">
      <ol>
        <li>Due date to furnish this form: <strong>31 March ${yr+1}</strong>
          <ol>
            <li>Form E will only be considered complete if C.P.8D is submitted on or before 31 March ${yr+1}. Employers who have submitted information via e-Data Praisi/e-CP8D before 25 February ${yr+1} are no longer required to complete and furnish C.P.8D via Form E. Employers which are Sole Proprietorship, Partnership, Hindu Joint Family and Deceased Person's Estate who do not have employees are exempted from submitting C.P.8D.</li>
            <li>Failure to furnish Form e-E on or before 31 March ${yr+1} is an offence under paragraph 120(1)(b) of the Income Tax Act 1967 (ITA 1967).</li>
            <li>Failure to prepare and render Form EA / EC to employees on or before 28 February ${yr+1} is an offence under paragraph 120(1)(b) of ITA 1967.</li>
          </ol>
        </li>
        <li>Submission via e-Filing (e-E) is mandatory for the following categories of employers:
          <ol>
            <li>Employers which are companies and Labuan companies (Companies) starting from the Year of Remuneration 2016.</li>
            <li>Employers other than companies starting from the Year of Remuneration 2023.</li>
          </ol>
          Please access via <em>https://mytax.hasil.gov.my</em>.
        </li>
        <li>Pursuant to section 89 of ITA 1967, a change of address must be notified to Lembaga Hasil Dalam Negeri Malaysia (LHDNM) within 3 months of the change. For the employer category of company, notification can be made through MyTax using the e-Kemaskini for company. Please visit <em>https://mytax.hasil.gov.my</em>. Whereas, for employer category of others than company, notification can be made by using Form CP600B (Change of Address Notification Form) which can be obtained at the LHDNM Official Portal, <em>https://www.hasil.gov.my</em>.</li>
        <li>For further information, please contact Hasil Contact Centre: &nbsp;<strong>03-89111000</strong> (Local) / <strong>603-89111000</strong> (Overseas)</li>
      </ol>
    </div>
  </div>

  <!-- FOR OFFICE USE -->
  <div style="font-weight:700;font-size:9px;margin-bottom:3px;">FOR OFFICE USE</div>
  <div class="office-use">
    <div class="ou-cell">Date received 1</div>
    <div class="ou-cell">Date received 2</div>
  </div>

</div>`;

  /* ════════════════════════════════════════════════════════════════
     PAGE 2 — Basic Particulars + Parts A, B, C
  ════════════════════════════════════════════════════════════════ */
  var pg2 = `<div class="page">

  <!-- Letterhead -->
  <div class="lhdn-hdr">
    <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAEHAYEDASIAAhEBAxEB/8QAHQABAAEEAwEAAAAAAAAAAAAAAAcBBAYIAgMFCf/EAFAQAAEDAwIDBQQFBwYJDQAAAAEAAgMEBREGBxIhMQgTQVFhFCIycRUjgZGhFjNCVZKx8CQ1UnLB0RclJzRidKKy0gk2NzhFU3N1goSU4fH/xAAcAQEAAQUBAQAAAAAAAAAAAAAAAQIDBAUGBwj/xAA6EQACAQMDAgMFBQcDBQAAAAAAAQIDBBEFITEGEhNBURQiMmGxByNSgaEVRFRxkcHRFmLhJDRC8PH/2gAMAwEAAhEDEQA/ANy0REAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREBxbJG5xa2RpIOCAei5LrEbWuJAAJPXC5Dy6q3CUnygckQoq8gIiKQEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAwmERRuAiIpAREQBERAEREAREQBERAEVHHAXH3vNR3LOAc0XXxOBwvFuGpqGku0Vte4mWQ4yOgVudaNOPdLYlJvg95FaMrIXVBpxOwy4z3efewrnJ81c7tu7yIOSKjVVSEEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEymVCeQUecNVOgVXHAXmX26Q2yhfPK4A493n1VqrWhSj3S4JUcssdY36Kz0LiHA1DxhjVHD546KCW93Qh0rgSxrj4+C75J3XCqkvd0dimjJLA4qHd29ccQma2QcAyGMysjp/Ra2v3SlJNU1+pFWoqSwY3rXdm+6f3CpL/R1TpHMdiWF7iWvZkciPsW2+2eubRrvTFPerXOwteAJYs+9G7yK+cN7nmuVaZ5CXZ/SWb7HbgXTbXU8NU1zpbVUkNqYc8iOnF6H+5eydS9F0LjT6btl2ziuPX5Gvo3D73ng+i0ecc1yXjaUv1v1BZae622Zs9PUMDmuB6cuh9QvWbKHYwDz6LxjDTcZLDXKNgnlZOaKmVUc1ICIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCHoiEgDJRvAKFD0TiGF1yyNY0ucQGgZJKoyo+8ScK2phpqZ00zgGNGTlRjd6x+obm58knd0VOcjyKvNV3We8Vxt9I/hgBw9w6KP9xdT0lnt7rbRvaAxv1jmnqVrrO1r67dqhR+FPclzVOOTxN19YwU8T6WndwQMGOEeJC1uv1znu9e9zieHPIK91lf5brWljHuLcnxXHStmqLncqahponSSzuAbgevVfSGj6dR0OyWyTS5/9waqrKVaWxlOy+20ustQRQzNe2gh96okA/Aeqmy/dn/QzqZ0tPWVVuDRnidJxNz581mumLbbNvNCsZP3cLWMElTJnBc7Gev3rXTdrcu66or5YKSokpLbG7hayN2C8eq8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" style="width:52px;height:52px;object-fit:contain;" alt="LHDN Logo">
    <div class="lhdn-text">
      <div class="t1">LEMBAGA HASIL DALAM NEGERI MALAYSIA</div>
      <div class="t2">RETURN FORM OF EMPLOYER &nbsp; UNDER SUBSECTION 83(1) OF THE INCOME TAX ACT 1967</div>
      <div class="t3">This form is prescribed under section 152 of the Income Tax Act 1967</div>
    </div>
    <div class="form-badge">
      <div class="fb-form">Form</div>
      <div class="fb-e" style="font-size:44px;">E</div>
      <div><span class="fb-yr" style="font-size:16px;">${yr}</span></div>
      <div class="fb-pin">CP8 - Pin. ${yr}</div>
    </div>
  </div>

  <div class="sec-title">BASIC PARTICULARS</div>

  <table class="bp">
    <tr>
      <td class="n">1</td>
      <td class="lb">Name of employer as registered</td>
      <td class="vl" colspan="3">${co.name||""}</td>
    </tr>
    <tr>
      <td class="n">2</td>
      <td class="lb">Employer's TIN</td>
      <td class="vl" colspan="3"><span class="tin-e">E</span> ${co.taxRef||""}</td>
    </tr>
    <tr>
      <td class="n">3</td>
      <td class="lb">Category of employer</td>
      <td class="vl" colspan="3">
        <span style="border:1px solid #555;padding:1px 4px;margin-right:6px;font-weight:700;">4</span>
        <span class="sm">1 = Government &nbsp;&nbsp; 2 = Statutory &nbsp;&nbsp; 3 = Local authority &nbsp;&nbsp; <b>4 = Private Sector – Company</b> &nbsp;&nbsp; 5 = Private Sector – Other than company &nbsp;&nbsp; 6 = Special class employer</span>
      </td>
    </tr>
    <tr>
      <td class="n">4</td>
      <td class="lb">Status of employer</td>
      <td class="vl" colspan="3">
        <span style="border:1px solid #555;padding:1px 4px;margin-right:6px;font-weight:700;">1</span>
        <span class="sm"><b>1 = In operation</b> &nbsp;&nbsp; 2 = Dormant &nbsp;&nbsp; 3 = In the process of winding up</span>
      </td>
    </tr>
    <tr>
      <td class="n">5</td>
      <td class="lb">Tax Identification No. (TIN)</td>
      <td class="vl" colspan="3">
        <span style="border:1px solid #555;padding:1px 4px;margin-right:6px;font-weight:700;">03=C</span>
        <span class="sm">01=IG &nbsp; 02=D &nbsp; <b>03=C</b> &nbsp; 04=J &nbsp; 05=F &nbsp; 06=TP &nbsp; 07=TA &nbsp; 08=TC &nbsp; 09=CS &nbsp; 10=TR &nbsp; 11=PT &nbsp; 12=TN &nbsp; 13=LE</span>
      </td>
    </tr>
    <tr>
      <td class="n">6</td>
      <td class="lb">Identification no.</td>
      <td class="vl">${co.regNo||""}</td>
      <td class="n">7</td>
      <td class="vl">Passport no. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
    </tr>
    <tr>
      <td class="n">8</td>
      <td class="lb">Registration no. with Companies Commission of Malaysia (SSM) or others</td>
      <td class="vl" colspan="3">${co.regNo||""}</td>
    </tr>
    <tr>
      <td class="n">9</td>
      <td class="lb">Correspondence address</td>
      <td class="vl" colspan="3">
        <div>${co.addr1||""} ${co.addr2||""}</div>
        <div style="display:grid;grid-template-columns:100px 1fr 100px 1fr;gap:4px;margin-top:4px;font-size:8px;">
          <span style="color:#555;">Postcode</span><span style="font-weight:700;">${co.postcode||""}</span>
          <span style="color:#555;">City</span><span style="font-weight:700;">${co.city||""}</span>
          <span style="color:#555;">State</span><span style="font-weight:700;">${co.state||""}</span>
          <span style="color:#555;">Country</span><span style="font-weight:700;">${co.country||"MALAYSIA"}</span>
        </div>
      </td>
    </tr>
    <tr>
      <td class="n">10</td>
      <td class="lb">Telephone no.</td>
      <td class="vl">${co.tel||co.phone||""}</td>
      <td class="n">11</td>
      <td class="vl">Handphone no. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
    </tr>
    <tr>
      <td class="n">12</td>
      <td class="lb">E-mail</td>
      <td class="vl" colspan="3">${co.email||""}</td>
    </tr>
    <tr>
      <td class="n">13</td>
      <td class="lb">Furnish of C.P.8D</td>
      <td class="vl" colspan="3">
        <span style="border:1px solid #555;padding:1px 4px;margin-right:6px;font-weight:700;">1</span>
        <span class="sm"><b>1 = Via e-Data Praisi / e-CP8D</b> &nbsp;&nbsp;
          2 = Exempted * &nbsp;&nbsp;
          <em>* Note = This exemption is applicable to employers which are Sole Proprietorship, Partnership, Hindu Joint Family and Deceased Person's Estate who do not have employees only</em>
        </span>
      </td>
    </tr>
  </table>

  <!-- PART A -->
  <div class="part-bar">PART A : &nbsp;&nbsp; INFORMATION ON NUMBER OF EMPLOYEES FOR THE YEAR ENDED 31 DECEMBER ${yr}</div>
  <div class="pA">
    <div class="pA-cell">
      <div class="pA-lbl">A1 &nbsp; Number of employees as at 31/12/${yr}</div>
      <div class="pA-val">${totalEmp}</div>
    </div>
    <div class="pA-cell" style="border-left:1px solid #ddd;">
      <div class="pA-lbl">A2 &nbsp; Number of employees subjected to Monthly Tax Deduction (MTD)</div>
      <div class="pA-val">${totalMTD}</div>
    </div>
    <div class="pA-cell" style="border-top:1px solid #ddd;">
      <div class="pA-lbl">A3 &nbsp; Number of new employees</div>
      <div class="pA-val">${newEmp||0}</div>
    </div>
    <div class="pA-cell" style="border-left:1px solid #ddd;border-top:1px solid #ddd;">
      <div class="pA-lbl">A4 &nbsp; Number of employees who ceased employment / died</div>
      <div class="pA-val">${cessEmp||0}</div>
    </div>
    <div class="pA-cell" style="border-top:1px solid #ddd;">
      <div class="pA-lbl">A5 &nbsp; Number of employees who ceased employment and left Malaysia</div>
      <div class="pA-val">0</div>
    </div>
    <div class="pA-cell" style="border-left:1px solid #ddd;border-top:1px solid #ddd;">
      <div class="pA-lbl">A6 &nbsp; Reported to LHDNM (If A5 is applicable)</div>
      <div class="pA-opt">1 = Yes &nbsp;&nbsp; 2 = No</div>
      <div class="pA-val">2</div>
    </div>
  </div>

  <!-- PART B -->
  <div class="part-bar">PART B: &nbsp;&nbsp; PARTICULARS OF TAX AGENT WHO COMPLETES THIS RETURN FORM</div>
  <div class="part-b">
    <div class="pb-row"><span class="pb-lbl">B1 &nbsp; Name of tax agent</span><span class="pb-val"></span></div>
    <div class="pb-row"><span class="pb-lbl">B2 &nbsp; Tax agent's approval no.</span><span class="pb-val">&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div class="pb-row"><span class="pb-lbl">B3 &nbsp; Name of firm</span><span class="pb-val"></span></div>
    <div class="pb-row"><span class="pb-lbl">B4 &nbsp; Firm's address</span><span class="pb-val"></span></div>
    <div style="display:grid;grid-template-columns:100px 1fr 80px 1fr;gap:4px;margin:3px 0;font-size:8px;">
      <span style="color:#555;">Postcode</span><span style="border-bottom:1px solid #aaa;"></span>
      <span style="color:#555;">City</span><span style="border-bottom:1px solid #aaa;"></span>
      <span style="color:#555;">State</span><span style="border-bottom:1px solid #aaa;"></span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px;">
      <div>
        <div class="pb-row"><span class="pb-lbl">B5 &nbsp; Firm's Tax Identification Number (TIN)</span><span class="pb-val"></span></div>
        <div class="pb-row"><span class="pb-lbl">B6 &nbsp; Firm's telephone number</span><span class="pb-val"></span></div>
        <div class="pb-row"><span class="pb-lbl">B7 &nbsp; Firm's e-mail</span><span class="pb-val"></span></div>
      </div>
      <div style="border-left:1px solid #ccc;padding-left:10px;">
        <div style="font-size:8px;color:#555;margin-bottom:4px;">B8 &nbsp; Tax agent's signature</div>
        <div style="height:32px;border-bottom:1px solid #555;margin-bottom:6px;"></div>
        <div class="pb-row"><span class="pb-lbl">B9 &nbsp; Date of signature (dd/mm/yyyy)</span><span class="pb-val"></span></div>
      </div>
    </div>
  </div>

  <!-- PART C -->
  <div class="part-bar">PART C: &nbsp;&nbsp; DECLARATION</div>
  <div class="decl">
    <div style="display:flex;align-items:baseline;gap:8px;">
      <span>I</span>
      <span style="border-bottom:1px solid #555;flex:1;min-height:14px;"></span>
      <span style="font-size:8px;color:#555;white-space:nowrap;">Identification / Passport No. *<br><em>(* Delete whichever is not relevant)</em></span>
      <span style="border-bottom:1px solid #555;width:120px;min-height:14px;"></span>
    </div>
    <div style="margin-top:6px;font-size:8.5px;">hereby declare that the return by this employer contains information which is true, complete and correct as required under the Income Tax Act 1967.</div>
    <div class="decl-row">
      <div class="decl-cell">Date (dd/mm/yyyy)<br><br><strong>${dateStr}</strong></div>
      <div class="decl-cell" style="text-align:center;">Signature</div>
      <div class="decl-cell">Designation<br><br><strong>${co.hrDesig||"Director / Authorised Officer"}</strong></div>
    </div>
    <div style="font-size:7.5px;color:#555;margin-top:8px;border-top:1px dotted #ccc;padding-top:4px;">
      NOTE: This declaration must be made by the employer in accordance with the category of employers as provided under sections 66 to 76 and section 86 of the Income Tax Act 1967
    </div>
  </div>

</div>`;

  /* ════════════════════════════════════════════════════════════════
     PAGE 3 — C.P.8D (22 columns exact per official form)
     Column order per PDF:
     1  Name of Employee
     2  Tax Identification No. (TIN)
     3  Identification / passport no.
     4  Category of employee
     5  Employee Status
     6  Date of retirement / End of contract
     7  Tax borne by employer (1=Yes/2=No)
     8  Total gross remuneration
     9  Benefit in kind
     10 Value of living accommodation
     11 Employee Share option Scheme (ESOS) benefit
     12 Tax exempt allowances/perquisites/gifts/benefits
     13 Medical insurance paid via salary deduction
     14 SOCSO contribution paid via salary deduction
     15 Total claim for deduction by employee via Form TP1 — Relief (RM)
     16 Total claim for deduction by employee via Form TP1 — Zakat other (RM)
     17 No. of children
     18 Total qualifying child relief
     19 Zakat paid via salary deduction
     20 Contribution to Employees Provident Fund
     21 Total tax deduction — MTD
     22 Total tax deduction — CP 38
  ════════════════════════════════════════════════════════════════ */
  var tbodyHtml = cpRows.map(function(r,i){
    var nv = function(v){ return v===0||v===null||v===undefined||v===""?"<td class=\"na\">n/a</td>":"<td class=\"r\">"+fmtZ(v)+"</td>"; };
    return '<tr>'+
      '<td style="font-weight:700;">'+r.name+'</td>'+
      '<td>'+r.tin+'</td>'+
      '<td style="font-family:monospace;">'+r.ic+'</td>'+
      '<td class="c">'+r.cat+'</td>'+
      '<td class="c">'+r.status+'</td>'+
      '<td class="c">'+(r.retDate&&r.retDate!=="n/a"?r.retDate:"n/a")+'</td>'+
      '<td class="c">'+r.taxBorne+'</td>'+
      nv(r.gross)+
      nv(r.bik)+
      nv(r.living)+
      nv(r.esos)+
      nv(r.exempt)+
      nv(r.medIns)+
      nv(r.socso)+
      nv(r.tp1rel)+
      '<td class="na">n/a</td>'+
      '<td class="c">'+(r.numChild||"0")+'</td>'+
      nv(r.childRel)+
      nv(r.zakatSal)+
      nv(r.epf)+
      nv(r.pcb)+
      nv(r.cp38)+
      '</tr>';
  }).join('');

  var tfootHtml = '<tr>'+
    '<td colspan="7" style="text-align:left;">TOTAL ('+totalEmp+' employees)</td>'+
    '<td class="r">'+fmtZ(tGross)+'</td>'+
    '<td></td><td></td><td></td><td></td><td></td>'+
    '<td class="r">'+fmtZ(tSocso)+'</td>'+
    '<td></td><td></td><td></td><td></td><td></td>'+
    '<td class="r">'+fmtZ(tEPF)+'</td>'+
    '<td class="r">'+fmtZ(tPCB)+'</td>'+
    '<td></td>'+
    '</tr>';

  var pg3 = `<div class="page-land">

  <!-- CP8D Letterhead -->
  <div class="lhdn-hdr" style="margin-bottom:5px;">
    <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAEHAYEDASIAAhEBAxEB/8QAHQABAAEEAwEAAAAAAAAAAAAAAAcBBAYIAgMFCf/EAFAQAAEDAwIDBQQFBwYJDQAAAAEAAgMEBREGBxIhMQgTQVFhFCIycRUjgZGhFjNCVZKx8CQ1UnLB0RclJzRidKKy0gk2NzhFU3N1goSU4fH/xAAcAQEAAQUBAQAAAAAAAAAAAAAAAQIDBAUGBwj/xAA6EQACAQMDAgMFBQcDBQAAAAAAAQIDBBEFITEGEhNBURQiMmGxByNSgaEVRFRxkcHRFmLhJDRC8PH/2gAMAwEAAhEDEQA/ANy0REAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREBxbJG5xa2RpIOCAei5LrEbWuJAAJPXC5Dy6q3CUnygckQoq8gIiKQEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAwmERRuAiIpAREQBERAEREAREQBERAEVHHAXH3vNR3LOAc0XXxOBwvFuGpqGku0Vte4mWQ4yOgVudaNOPdLYlJvg95FaMrIXVBpxOwy4z3efewrnJ81c7tu7yIOSKjVVSEEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEymVCeQUecNVOgVXHAXmX26Q2yhfPK4A493n1VqrWhSj3S4JUcssdY36Kz0LiHA1DxhjVHD546KCW93Qh0rgSxrj4+C75J3XCqkvd0dimjJLA4qHd29ccQma2QcAyGMysjp/Ra2v3SlJNU1+pFWoqSwY3rXdm+6f3CpL/R1TpHMdiWF7iWvZkciPsW2+2eubRrvTFPerXOwteAJYs+9G7yK+cN7nmuVaZ5CXZ/SWb7HbgXTbXU8NU1zpbVUkNqYc8iOnF6H+5eydS9F0LjT6btl2ziuPX5Gvo3D73ng+i0ecc1yXjaUv1v1BZae622Zs9PUMDmuB6cuh9QvWbKHYwDz6LxjDTcZLDXKNgnlZOaKmVUc1ICIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCHoiEgDJRvAKFD0TiGF1yyNY0ucQGgZJKoyo+8ScK2phpqZ00zgGNGTlRjd6x+obm58knd0VOcjyKvNV3We8Vxt9I/hgBw9w6KP9xdT0lnt7rbRvaAxv1jmnqVrrO1r67dqhR+FPclzVOOTxN19YwU8T6WndwQMGOEeJC1uv1znu9e9zieHPIK91lf5brWljHuLcnxXHStmqLncqahponSSzuAbgevVfSGj6dR0OyWyTS5/9waqrKVaWxlOy+20ustQRQzNe2gh96okA/Aeqmy/dn/QzqZ0tPWVVuDRnidJxNz581mumLbbNvNCsZP3cLWMElTJnBc7Gev3rXTdrcu66or5YKSokpLbG7hayN2C8eq8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" style="width:40px;height:40px;object-fit:contain;" alt="LHDN Logo">
    <div class="lhdn-text">
      <div class="t1">LEMBAGA HASIL DALAM NEGERI MALAYSIA</div>
      <div class="t2">RETURN ON REMUNERATION FROM EMPLOYMENT, CLAIM FOR DEDUCTION AND PARTICULARS OF INCOME TAX DEDUCTION</div>
      <div class="t2">UNDER THE INCOME TAX RULES (DEDUCTION FROM REMUNERATION) 1994 FOR THE YEAR ENDED 31 DECEMBER ${yr}</div>
    </div>
    <div style="font-size:8px;text-align:right;white-space:nowrap;padding-left:8px;">C.P.8D-Pin. ${yr}</div>
  </div>

  <!-- Employer particulars -->
  <div class="cp8d-employer">
    <strong>PARTICULARS OF EMPLOYER</strong>
    <div style="display:flex;flex-wrap:wrap;gap:20px;margin-top:3px;">
      <span>Employer's TIN &nbsp;<strong>E ${co.taxRef||""}</strong></span>
      <span>Name of Employer: &nbsp;<strong>${co.name||""}</strong></span>
      <span>Remuneration for the year: &nbsp;<strong>${yr}</strong></span>
    </div>
  </div>

  <!-- Notes -->
  <div class="cp8d-notes">
    <strong>PARTICULARS OF EMPLOYEE</strong><br>
    I. An employer is required to complete this statement on all employees for the year ${yr}. Employers who have submitted information via e-Data Praisi/e-CP8D before 25 February ${yr+1} are no longer required to complete and furnish Form C.P.8D via Form e-E.<br>
    II. The column is <strong>COMPULSORY</strong> to be completed: &nbsp;
      (a) Column 1 – Name &nbsp; (b) Column 2 – TIN &nbsp; (c) Column 3 – IC/Passport &nbsp; (d) Column 4 – Category &nbsp; (e) Column 5 – Status &nbsp; (f) Column 6 – Retirement/End of Contract<br>
    <strong>NOTES:</strong> &nbsp;
      Category: <strong>1</strong> = Single &nbsp; <strong>2</strong> = Married spouse not working &nbsp; <strong>3</strong> = Married spouse working/divorced/widowed/single with adopted child &nbsp;&nbsp;
      Status: <strong>1</strong> = Management &nbsp; <strong>2</strong> = Permanent &nbsp; <strong>3</strong> = Contract &nbsp; <strong>4</strong> = Part time &nbsp; <strong>5</strong> = Interns &nbsp; <strong>6</strong> = Others
  </div>

  <!-- CP8D Table (A4 landscape-optimised, 22 cols) -->
  <div class="cp8d-wrap">
    <table class="cp8d" style="width:100%;">
      <thead>
        <!-- Row 1: column group labels -->
        <tr>
          <th rowspan="3" style="min-width:10px;">No.</th>
          <th rowspan="3" style="min-width:90px;">Name of<br>Employee</th>
          <th rowspan="3" style="min-width:64px;">Tax<br>Identification<br>No. (TIN)</th>
          <th rowspan="3" style="min-width:72px;">Identification /<br>passport no.</th>
          <th rowspan="3">Category<br>of<br>employee<sup>1</sup></th>
          <th rowspan="3">Employee<br>Status<sup>2</sup></th>
          <th rowspan="3" style="min-width:52px;">Date of<br>retirement /<br>End of<br>contract</th>
          <th rowspan="3" style="min-width:38px;">Tax<br>borne by<br>employer<br>(Enter<br>1 or 2)</th>
          <th rowspan="3" style="min-width:52px;">Total gross<br>remuneration<sup>3</sup><br>(RM)</th>
          <th rowspan="3" style="min-width:40px;">Benefit<br>in kind<br>(RM)</th>
          <th rowspan="3" style="min-width:44px;">Value of<br>living<br>accommod-<br>ation<br>(RM)</th>
          <th rowspan="3" style="min-width:40px;">Employee<br>Share option<br>Scheme<br>(ESOS)<br>benefit<br>(RM)</th>
          <th rowspan="3" style="min-width:48px;">Tax exempt<br>allowances /<br>perquisites /<br>gifts /<br>benefits<br>(RM)</th>
          <th rowspan="3" style="min-width:44px;">Medical<br>insurance<br>paid via<br>salary<br>deduction<br>(RM)</th>
          <th rowspan="3" style="min-width:44px;">SOCSO<br>contribution<br>paid via salary<br>deduction<br>(RM)</th>
          <th colspan="2" style="background:#2a2a6e;">Total claim for deduction by<br>employee via Form TP1</th>
          <th colspan="2" style="background:#2a2a6e;">Qualifying child relief</th>
          <th rowspan="3" style="min-width:44px;">Zakat paid<br>via salary<br>deduction<sup>4</sup><br>(RM)</th>
          <th rowspan="3" style="min-width:48px;">Contribution<br>to Employees<br>Provident<br>Fund<br>(RM)</th>
          <th colspan="2" style="background:#2a2a6e;">Total tax deduction</th>
        </tr>
        <tr>
          <th style="min-width:44px;">Relief<br>(RM)</th>
          <th style="min-width:44px;">Zakat<br>other than<br>via salary<br>(RM)</th>
          <th style="min-width:36px;">No. of<br>children</th>
          <th style="min-width:44px;">Total<br>relief<br>(RM)</th>
          <th style="min-width:44px;">MTD<br>(RM)</th>
          <th style="min-width:44px;">CP 38<br>(RM)</th>
        </tr>
        <tr>
          <th>(RM)</th><th>(RM)</th><th></th><th>(RM)</th><th>(RM)</th><th>(RM)</th>
        </tr>
      </thead>
      <tbody>
        ${(function(){
          return cpRows.map(function(r,i){
            var nv = function(v){ return v===0||v===null||v===undefined||v===""?'<td class="na">n/a</td>':'<td class="r">'+fmtZ(v)+'</td>'; };
            return '<tr>'+
              '<td class="c">'+(i+1)+'</td>'+
              '<td style="font-weight:700;">'+r.name+'</td>'+
              '<td>'+r.tin+'</td>'+
              '<td style="font-family:monospace;">'+r.ic+'</td>'+
              '<td class="c">'+r.cat+'</td>'+
              '<td class="c">'+r.status+'</td>'+
              '<td class="c">'+(r.retDate&&r.retDate!=="n/a"?r.retDate:"n/a")+'</td>'+
              '<td class="c">'+r.taxBorne+'</td>'+
              nv(r.gross)+
              nv(r.bik)+
              nv(r.living)+
              nv(r.esos)+
              nv(r.exempt)+
              nv(r.medIns)+
              nv(r.socso)+
              nv(r.tp1rel)+
              '<td class="na">n/a</td>'+
              '<td class="c">'+(r.numChild||"0")+'</td>'+
              nv(r.childRel)+
              nv(r.zakatSal)+
              nv(r.epf)+
              nv(r.pcb)+
              nv(r.cp38)+
              '</tr>';
          }).join('');
        })()}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="8" style="font-weight:700;">TOTAL (${totalEmp} employees)</td>
          <td class="r">${fmtZ(tGross)}</td>
          <td></td><td></td><td></td><td></td><td></td>
          <td class="r">${fmtZ(tSocso)}</td>
          <td></td><td></td><td></td><td></td><td></td>
          <td class="r">${fmtZ(tEPF)}</td>
          <td class="r">${fmtZ(tPCB)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div style="font-size:7px;color:#555;margin-top:6px;border-top:1px solid #ccc;padding-top:4px;">
    <sup>1</sup> Category of employee (as per MTD Schedule) &nbsp;&nbsp;
    <sup>2</sup> Employee Status &nbsp;&nbsp;
    <sup>3</sup> Including benefits in kind, value of living accommodation benefit provided and gross remuneration in arrears in respect of preceding years &nbsp;&nbsp;
    <sup>4</sup> Amount of zakat OTHER THAN that paid via monthly salary deduction
  </div>

</div>`;

  return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n'+
    '<title>Form E '+yr+' — '+(co.name||"Employer")+'</title>\n'+
    '<style>\n'+css+'\n</style>\n'+
    '</head>\n<body>\n'+
    '<button class="print-btn" onclick="window.print()">&#128438; &nbsp; Print / Save as PDF &nbsp;— Form E '+yr+'</button>\n'+
    pg1+pg2+pg3+
    '</body>\n</html>';
}
// ── FormEView — React component: preview + download button ───────────────────
function FormEView(p) {
  var employees = p.employees || [];
  var company   = p.company || {name:"TechCorp Sdn. Bhd.",regNo:"123456-A"};
  var yr        = p.yr || 2025;
  var rows      = employees.map(function(e){ return computeRow(e,26,{}); });
  var rm2       = function(v){ return "RM "+parseFloat(v||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); };
  var totalGross= rows.reduce(function(s,r){return s+r.grossTotal*12;},0);
  var totalPCB  = rows.reduce(function(s,r){return s+r.pcb*12;},0);
  var totalEPF  = rows.reduce(function(s,r){return s+r.epfEe*12;},0);

  var handleDownload = function() {
    var html = generateFormEHTML(employees, company, yr);
    var blob = new Blob([html], {type:"text/html;charset=utf-8"});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement("a");
    a.href   = url;
    a.download = "FormE_CP8_"+yr+"_"+(company.name||"").replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_]/g,"")+".html";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); },2000);
  };

  return (
    <div style={{fontFamily:"Arial,sans-serif",background:"#fff",padding:0,maxWidth:760,margin:"0 auto"}}>
      {/* Download CTA banner */}
      <div style={{background:"linear-gradient(135deg,#1E40AF,#1E3A8A)",borderRadius:"10px 10px 0 0",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:0}}>
        <div>
          <div style={{color:"#fff",fontWeight:800,fontSize:14}}>Form E (CP8 - Pin. {yr}) — Official LHDN Format</div>
          <div style={{color:"#93C5FD",fontSize:11,marginTop:3}}>3-page official form: Cover Page · Basic Particulars · C.P.8D Employee List</div>
        </div>
        <button onClick={handleDownload}
          style={{background:"#fff",color:"#1E40AF",border:"none",borderRadius:8,padding:"10px 20px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
          ⬇ Download Form E
        </button>
      </div>

      {/* Summary strip */}
      <div style={{background:"#EFF6FF",border:"1.5px solid #BFDBFE",borderTop:"none",padding:"10px 16px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
        {[
          ["Total Employees",employees.length,"#1E40AF"],
          ["Annual Gross",rm2(totalGross),"#059669"],
          ["Total PCB/MTD",rm2(totalPCB),"#7C3AED"],
          ["Total EPF (EE)",rm2(totalEPF),"#D97706"],
        ].map(function(item,i){return(
          <div key={i} style={{textAlign:"center"}}>
            <div style={{color:item[2],fontWeight:900,fontSize:16}}>{item[0]}</div>
            <div style={{color:"#374151",fontSize:10,marginTop:1,fontWeight:600}}>{item[1]}</div>
          </div>
        );})}
      </div>

      {/* C.P.8D Preview Table */}
      <div style={{background:"#F8FAFF",border:"1px solid #BFDBFE",borderRadius:8,overflow:"hidden",marginBottom:12}}>
        <div style={{background:"#1E3A8A",color:"#fff",padding:"8px 14px",fontWeight:700,fontSize:11,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>C.P.8D — Employee List Preview ({employees.length} employees)</span>
          <span style={{fontSize:9,opacity:.7}}>Scroll right to see all 22 columns in the downloaded form</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
            <thead>
              <tr style={{background:"#EFF6FF"}}>
                {["No","Name","NRIC / IC","TIN / Tax File","Cat","Status","Annual Gross","EPF (EE)","SOCSO","MTD/PCB"].map(function(h,hi){return(
                  <th key={h} style={{padding:"6px 8px",textAlign:hi>=6?"right":"left",color:"#1E3A8A",fontWeight:700,borderBottom:"2px solid #BFDBFE",fontSize:9,whiteSpace:"nowrap"}}>{h}</th>
                );})}
              </tr>
            </thead>
            <tbody>
              {employees.map(function(e,i){
                var r = rows[i];
                return(
                  <tr key={e.id} style={{borderBottom:"1px solid #E2E8F0",background:i%2===0?"transparent":"#F0F7FF"}}>
                    <td style={{padding:"5px 8px",color:"#6B7280",fontSize:10}}>{i+1}</td>
                    <td style={{padding:"5px 8px",fontWeight:700,color:"#111827",fontSize:10}}>{e.name}</td>
                    <td style={{padding:"5px 8px",fontFamily:"monospace",color:"#374151",fontSize:9}}>{e.nric||"-"}</td>
                    <td style={{padding:"5px 8px",color:"#374151",fontSize:9}}>{e.taxNo||"-"}</td>
                    <td style={{padding:"5px 8px",textAlign:"center",color:"#6B7280",fontSize:10}}>{e.spouseRelief?"2":"1"}</td>
                    <td style={{padding:"5px 8px",textAlign:"center",color:"#6B7280",fontSize:10}}>2</td>
                    <td style={{padding:"5px 8px",textAlign:"right",color:"#059669",fontWeight:700,fontSize:10}}>{rm2(r.grossTotal*12)}</td>
                    <td style={{padding:"5px 8px",textAlign:"right",color:"#0EA5C9",fontWeight:600,fontSize:10}}>{rm2(r.epfEe*12)}</td>
                    <td style={{padding:"5px 8px",textAlign:"right",color:"#374151",fontSize:10}}>{rm2(r.socsoEe*12)}</td>
                    <td style={{padding:"5px 8px",textAlign:"right",color:"#7C3AED",fontWeight:700,fontSize:10}}>{rm2(r.pcb*12)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:"#1E3A8A",color:"#fff",fontWeight:700}}>
                <td colSpan={6} style={{padding:"7px 8px",fontSize:10}}>TOTAL ({employees.length} employees)</td>
                <td style={{padding:"7px 8px",textAlign:"right",fontSize:10}}>{rm2(totalGross)}</td>
                <td style={{padding:"7px 8px",textAlign:"right",fontSize:10}}>{rm2(totalEPF)}</td>
                <td style={{padding:"7px 8px",textAlign:"right",fontSize:10}}>{rm2(rows.reduce(function(s,r){return s+r.socsoEe*12;},0))}</td>
                <td style={{padding:"7px 8px",textAlign:"right",fontSize:10}}>{rm2(totalPCB)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Declaration preview */}
      <div style={{background:"#FFFBEB",border:"1.5px solid #FCD34D",borderRadius:8,padding:"10px 14px",marginBottom:8}}>
        <div style={{color:"#92400E",fontWeight:700,fontSize:10,marginBottom:6}}>PART C — DECLARATION</div>
        <div style={{color:"#374151",fontSize:9,lineHeight:1.7}}>
          I hereby declare that the return by this employer contains information which is true, complete and correct as required under the Income Tax Act 1967.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginTop:12}}>
          {["Date","Signature","Designation"].map(function(l,i){return(
            <div key={i} style={{borderTop:"1.5px solid #374151",paddingTop:5,color:"#6B7280",fontSize:9}}>{l}</div>
          );})}
        </div>
      </div>
      <div style={{fontSize:9,color:"#9CA3AF",textAlign:"center",padding:"6px 0"}}>
        Form E must be submitted to LHDN by 31 March {yr+1} via MyTax (mytax.hasil.gov.my) per Section 83(1) ITA 1967
      </div>
    </div>
  );
}


// ── Report export helpers ────────────────────────────────────────────────────
function rptDownload(content, filename, mime) {
  var blob = new Blob([content], {type: mime});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
}

function toCsvRow(arr) {
  return arr.map(function(v){
    var s = String(v==null?"":v).replace(/"/g,'""');
    return /[,"\n\r]/.test(s) ? '"'+s+'"' : s;
  }).join(",");
}

function toCsv(rows) { return rows.map(toCsvRow).join("\r\n"); }

function printReportHTML(title, tableHTML, coName, yr) {
  var today = new Date().toLocaleDateString("en-MY",{day:"2-digit",month:"short",year:"numeric"});
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+title+'</title><style>\n'+
    'body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0;padding:16px;background:#fff}\n'+
    'h2{font-size:14px;margin:0 0 2px;color:#0D1226}'+
    '.sub{font-size:9px;color:#666;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #ccc}\n'+
    'table{width:100%;border-collapse:collapse;margin-top:10px}\n'+
    'th{background:#0D1226;color:#fff;padding:6px 8px;text-align:left;font-size:9px;white-space:nowrap}\n'+
    'th.r{text-align:right} td{padding:5px 8px;font-size:9px;border-bottom:1px solid #e5e7eb}\n'+
    'td.r{text-align:right} tr:nth-child(even) td{background:#f8faff}\n'+
    'tfoot td{background:#f0f4ff;font-weight:700;border-top:2px solid #0D1226}\n'+
    '.btn{display:inline-block;background:#1E40AF;color:#fff;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;margin-bottom:12px}\n'+
    '@media print{.btn{display:none}}\n'+
    '</style></head><body>\n'+
    '<button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button>\n'+
    '<h2>'+title+' — '+yr+'</h2>\n'+
    '<div class="sub">'+coName+' &nbsp;·&nbsp; Generated: '+today+'</div>\n'+
    tableHTML+
    '</body></html>';
}

function ReportExportBar(props) {
  var onPDF   = props.onPDF;
  var onExcel = props.onExcel;
  var label   = props.label || "";
  var [toast, setToast] = useState(null);
  var fire = function(fn, msg) {
    fn();
    setToast(msg);
    setTimeout(function(){ setToast(null); }, 2800);
  };
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto",position:"relative"}}>
      {toast && (
        <div style={{position:"fixed",top:16,right:20,zIndex:9999,background:C.green,color:"#fff",padding:"9px 16px",borderRadius:8,fontWeight:700,fontSize:12,boxShadow:"0 4px 16px rgba(0,0,0,.2)",animation:"fadeIn .2s ease"}}>
          {toast}
        </div>
      )}
      <button onClick={function(){ fire(onPDF, "📄 PDF-ready file downloaded"); }}
        style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#DC2626,#B91C1C)",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        <FileText size={13}/> PDF
      </button>
      <button onClick={function(){ fire(onExcel, "📊 Excel/CSV downloaded"); }}
        style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#059669,#047857)",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        <FileSpreadsheet size={13}/> Excel
      </button>
    </div>
  );
}

function ReportsModule(props) {
  var employees = props.employees || [];
  var activeCompany = props.activeCompany;
  var companies = props.companies || [];
  var co = companies.find(function(c){return c.id===activeCompany;}) || companies[0] || {};

  var [rptTab, setRptTab] = useState("payroll");
  var [selYr, setSelYr] = useState(2025);
  var [selEA, setSelEA] = useState(null);
  var [showFormE, setShowFormE] = useState(false);
  var [eaLang, setEaLang] = useState("EN");

  var rows = employees.map(function(e){ return computeRow(e,26,{}); });
  var rm2  = function(v){ return "RM "+parseFloat(v||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); };

  var TABS = [["payroll","Payroll Summary"],["statutory","Statutory"],["headcount","Headcount"],["formEA","Borang EA"],["formE","Borang E"]];

  return (
    <div>
      <SectionHead title="Reports" sub="Payroll, statutory, Borang E and EA reports" />

      {/* Borang EA — full-screen preview + download */}
      {selEA && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(10,18,40,.85)",zIndex:3000,display:"flex",flexDirection:"column"}}>
          {/* Top toolbar */}
          <div style={{background:"#0F172A",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,.1)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{color:"#fff",fontWeight:700,fontSize:14}}>📋 Borang EA {selYr} — {selEA.name}</span>
              {/* Language toggle */}
              <div style={{display:"flex",borderRadius:7,overflow:"hidden",border:"1px solid rgba(255,255,255,.25)",marginLeft:8}}>
                {[["EN","🇬🇧 English"],["BM","🇲🇾 BM"]].map(function(opt){
                  return (
                    <button key={opt[0]} onClick={function(){setEaLang(opt[0]);}} style={{padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"none",background:eaLang===opt[0]?"#4F6EF7":"transparent",color:"#fff",transition:"background .15s"}}>
                      {opt[1]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button onClick={function(){generateEaPDF(buildEA(selEA,selYr),eaLang,co);}} style={{background:"linear-gradient(135deg,#059669,#047857)",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                ⬇ Download {eaLang==="BM"?"(BM)":"(English)"}
              </button>
              <button onClick={function(){setSelEA(null);}} style={{background:"rgba(255,255,255,.12)",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
            </div>
          </div>
          {/* Scrollable preview area */}
          <div style={{flex:1,overflowY:"auto",padding:"24px",display:"flex",justifyContent:"center",background:"#1E293B"}}>
            <div style={{width:"100%",maxWidth:780,background:"#fff",borderRadius:6,boxShadow:"0 8px 40px rgba(0,0,0,.5)",overflow:"hidden"}}>
              <EAPreview data={buildEA(selEA,selYr)} lang={eaLang} co={co} />
            </div>
          </div>
        </div>
      )}

      {/* Form E modal */}
      {showFormE && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,.6)",zIndex:3000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"24px 20px",overflowY:"auto"}}>
          <div style={{maxWidth:760,width:"100%"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{color:"#fff",fontWeight:700,fontSize:15}}>Borang E {selYr}</span>
              <div style={S.rowG8}>
                <button onClick={function(){window.print();}} style={{background:"#DC2626",color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Print / Save PDF</button>
                <button onClick={function(){setShowFormE(false);}} style={{background:"rgba(255,255,255,.2)",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>x Close</button>
              </div>
            </div>
            <FormEView employees={employees} company={co} yr={selYr} />
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        {TABS.map(function(t){return(
          <button key={t[0]} onClick={function(){setRptTab(t[0]);}} style={{background:rptTab===t[0]?C.accentL:"transparent",color:rptTab===t[0]?C.accent:C.ts,border:"1.5px solid "+(rptTab===t[0]?C.accent+"66":C.border),borderRadius:8,padding:"7px 18px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t[1]}</button>        );})}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <span style={S.ts11}>Year:</span>
          <select value={selYr} onChange={function(e){setSelYr(parseInt(e.target.value));}} style={Object.assign({},selectStyle,{marginBottom:0,width:80,fontSize:11,padding:"4px 8px"})}>
            {[2023,2024,2025,2026].map(function(y){return <option key={y} value={y}>{y}</option>;})}
          </select>
        </div>
      </div>

      {rptTab === "payroll" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{color:C.ts,fontSize:12}}>Monthly payroll for <b>{selYr}</b> — {employees.length} employees</div>
            <ReportExportBar
              onPDF={function(){
                var thead = '<tr style="background:#0D1226;color:#fff"><th>Emp No</th><th>Employee</th><th>Dept</th><th class="r">Basic</th><th class="r">Allowances</th><th class="r">Gross</th><th class="r">EPF EE</th><th class="r">SOCSO</th><th class="r">EIS</th><th class="r">PCB</th><th class="r">Net Pay</th></tr>';
                var tbody = rows.map(function(r){
                  var emp2=employees.find(function(e){return e.id===r.empId;})||{};
                  var allw=r.support+r.travel+r.other;
                  return '<tr><td style="font-family:monospace">'+(emp2.empNo||r.empId)+'</td><td>'+r.name+'</td><td>'+r.dept+'</td><td class="r">'+r.basic.toFixed(2)+'</td><td class="r">'+allw.toFixed(2)+'</td><td class="r" style="color:#059669;font-weight:700">'+r.grossTotal.toFixed(2)+'</td><td class="r">'+r.epfEe+'</td><td class="r">'+r.socsoEe.toFixed(2)+'</td><td class="r">'+r.eisEe.toFixed(2)+'</td><td class="r" style="color:#7C3AED">'+r.pcb.toFixed(2)+'</td><td class="r" style="color:#059669;font-weight:800">'+r.netTotal.toFixed(2)+'</td></tr>';
                }).join("");
                var tfoot = '<tfoot><tr><td colspan="3">TOTAL ('+rows.length+' employees)</td><td class="r">'+sumF(rows,"basic").toFixed(2)+'</td><td class="r">'+(sumF(rows,"support")+sumF(rows,"travel")+sumF(rows,"other")).toFixed(2)+'</td><td class="r">'+sumF(rows,"grossTotal").toFixed(2)+'</td><td class="r">'+sumF(rows,"epfEe")+'</td><td class="r">'+sumF(rows,"socsoEe").toFixed(2)+'</td><td class="r">'+sumF(rows,"eisEe").toFixed(2)+'</td><td class="r">'+sumF(rows,"pcb").toFixed(2)+'</td><td class="r">'+sumF(rows,"netTotal").toFixed(2)+'</td></tr></tfoot>';
                var html = printReportHTML("Payroll Summary","<table>"+thead+"<tbody>"+tbody+"</tbody>"+tfoot+"</table>",co.name||"HRCloud",selYr);
                rptDownload(html,"Payroll_Summary_"+selYr+".html","text/html;charset=utf-8");
              }}
              onExcel={function(){
                var hdr = ["Emp No","Employee","Dept","Basic","Allowances","Gross","EPF EE","SOCSO","EIS","PCB","Net Pay"];
                var data = rows.map(function(r){
                  var emp2=employees.find(function(e){return e.id===r.empId;})||{};
                  return [emp2.empNo||r.empId,r.name,r.dept,r.basic.toFixed(2),(r.support+r.travel+r.other).toFixed(2),r.grossTotal.toFixed(2),r.epfEe,r.socsoEe.toFixed(2),r.eisEe.toFixed(2),r.pcb.toFixed(2),r.netTotal.toFixed(2)];
                });
                rptDownload(toCsv([hdr].concat(data)),"Payroll_Summary_"+selYr+".csv","text/csv;charset=utf-8");
              }}
            />
          </div>
          <Card noPad style={{overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:C.surface}}>
                  {["Emp No","Employee","Dept","Basic","Allowances","Gross","EPF EE","SOCSO","EIS","PCB","Net Pay"].map(function(h){return(
                    <th key={h} style={{padding:"10px 10px",textAlign:h==="Emp No"||h==="Employee"||h==="Dept"?"left":"right",color:C.ts,fontWeight:700,borderBottom:"2px solid "+C.border,whiteSpace:"nowrap"}}>{h}</th>                  );})}
                </tr>
              </thead>
              <tbody>
                {rows.map(function(r,i){
                  var emp = employees.find(function(e){return e.id===r.empId;}) || {};
                  var allw = r.support+r.travel+r.other;
                  return(
                    <tr key={r.empId} style={{borderBottom:"1px solid "+C.border+"33",background:i%2===0?"transparent":"#F8FCFF"}}>
                      <td style={{padding:"8px 10px",color:C.ts,fontSize:11,fontFamily:"monospace"}}>{emp.empNo||r.empId}</td>
                      <td style={{padding:"8px 10px",color:C.tp,fontWeight:600}}>{r.name}</td>
                      <td style={{padding:"8px 10px",color:C.ts}}>{r.dept}</td>
                      <td style={{padding:"8px 10px",textAlign:"right"}}>{r.basic.toFixed(2)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right"}}>{allw.toFixed(2)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:C.green,fontWeight:700}}>{r.grossTotal.toFixed(2)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right"}}>{r.epfEe}</td>
                      <td style={{padding:"8px 10px",textAlign:"right"}}>{r.socsoEe.toFixed(2)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right"}}>{r.eisEe.toFixed(2)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:C.purple}}>{r.pcb.toFixed(2)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:C.green,fontWeight:800}}>{r.netTotal.toFixed(2)}</td>
                    </tr>                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:C.surface,fontWeight:700,borderTop:"2px solid "+C.border}}>
                  <td style={{padding:"9px 10px",color:C.ts,fontSize:11}} colSpan={3}>TOTAL ({rows.length} employees)</td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>{sumF(rows,"basic").toFixed(2)}</td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>{(sumF(rows,"support")+sumF(rows,"travel")+sumF(rows,"other")).toFixed(2)}</td>
                  <td style={{padding:"9px 10px",textAlign:"right",color:C.green}}>{sumF(rows,"grossTotal").toFixed(2)}</td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>{sumF(rows,"epfEe")}</td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>{sumF(rows,"socsoEe").toFixed(2)}</td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>{sumF(rows,"eisEe").toFixed(2)}</td>
                  <td style={{padding:"9px 10px",textAlign:"right",color:C.purple}}>{sumF(rows,"pcb").toFixed(2)}</td>
                  <td style={{padding:"9px 10px",textAlign:"right",color:C.green,fontSize:14}}>{sumF(rows,"netTotal").toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
        </div>
      )}
      {rptTab === "statutory" && (
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{color:C.tp,fontWeight:700,fontSize:14}}>Statutory Contribution Summary - {selYr}</div>
            <ReportExportBar
              onPDF={function(){
                var statRows = [
                  {l:"EPF Employee",  v:sumF(rows,"epfEe")},
                  {l:"EPF Employer",  v:sumF(rows,"epfEr")},
                  {l:"SOCSO Employee",v:sumF(rows,"socsoEe")},
                  {l:"SOCSO Employer",v:sumF(rows,"socsoEr")},
                  {l:"EIS Employee",  v:sumF(rows,"eisEe")},
                  {l:"EIS Employer",  v:sumF(rows,"eisEr")},
                  {l:"PCB (MTD)",     v:sumF(rows,"pcb")},
                  {l:"HRDF",          v:sumF(rows,"hrdf")},
                ];
                var tbody = statRows.map(function(r){ return '<tr><td>'+r.l+'</td><td class="r" style="font-weight:700">'+rm(r.v)+'</td></tr>'; }).join("");
                var html = printReportHTML("Statutory Contributions","<table><tr style=\"background:#0D1226;color:#fff\"><th>Contribution</th><th class=\"r\">Amount (RM)</th></tr><tbody>"+tbody+"</tbody></table>",co.name||"HRCloud",selYr);
                rptDownload(html,"Statutory_"+selYr+".html","text/html;charset=utf-8");
              }}
              onExcel={function(){
                var hdr = ["Contribution","Amount (RM)"];
                var data = [
                  ["EPF Employee",  sumF(rows,"epfEe")],
                  ["EPF Employer",  sumF(rows,"epfEr")],
                  ["SOCSO Employee",sumF(rows,"socsoEe")],
                  ["SOCSO Employer",sumF(rows,"socsoEr")],
                  ["EIS Employee",  sumF(rows,"eisEe")],
                  ["EIS Employer",  sumF(rows,"eisEr")],
                  ["PCB (MTD)",     sumF(rows,"pcb")],
                  ["HRDF",          sumF(rows,"hrdf")],
                ];
                rptDownload(toCsv([hdr].concat(data)),"Statutory_"+selYr+".csv","text/csv;charset=utf-8");
              }}
            />
          </div>

          {[
            {l:"EPF Employee",v:sumF(rows,"epfEe"),c:C.green},{l:"EPF Employer",v:sumF(rows,"epfEr"),c:C.green},
            {l:"SOCSO Employee",v:sumF(rows,"socsoEe"),c:C.accent},{l:"SOCSO Employer",v:sumF(rows,"socsoEr"),c:C.accent},
            {l:"EIS Employee",v:sumF(rows,"eisEe"),c:C.accent},{l:"EIS Employer",v:sumF(rows,"eisEr"),c:C.accent},
            {l:"PCB (MTD)",v:sumF(rows,"pcb"),c:C.purple},{l:"HRDF",v:sumF(rows,"hrdf"),c:C.amber},
          ].map(function(item){return(
            <div key={item.l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid "+C.border+"44"}}>
              <span style={S.ts13}>{item.l}</span>
              <span style={{color:item.c,fontWeight:700}}>{rm(item.v)}</span>
            </div>          );})}
        </Card>
      )}
      {rptTab === "headcount" && (
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
            <ReportExportBar
              onPDF={function(){
                var dDept={};employees.forEach(function(e){dDept[e.dept]=(dDept[e.dept]||0)+1;});
                var dStat={};employees.forEach(function(e){dStat[e.status]=(dStat[e.status]||0)+1;});
                var dGrade={};employees.forEach(function(e){dGrade[e.grade||"N/A"]=(dGrade[e.grade||"N/A"]||0)+1;});
                var rows1 = Object.keys(dDept).map(function(k){return '<tr><td>'+k+'</td><td class="r">'+dDept[k]+'</td></tr>';}).join("");
                var rows2 = Object.keys(dStat).map(function(k){return '<tr><td>'+k+'</td><td class="r">'+dStat[k]+'</td></tr>';}).join("");
                var html = printReportHTML("Headcount Report",
                  '<b>By Department</b><table><tr style="background:#0D1226;color:#fff"><th>Department</th><th class="r">Count</th></tr><tbody>'+rows1+'</tbody></table>'+
                  '<br/><b>By Status</b><table><tr style="background:#0D1226;color:#fff"><th>Status</th><th class="r">Count</th></tr><tbody>'+rows2+'</tbody></table>',
                  co.name||"HRCloud",selYr);
                rptDownload(html,"Headcount_"+selYr+".html","text/html;charset=utf-8");
              }}
              onExcel={function(){
                var dDept={};employees.forEach(function(e){dDept[e.dept]=(dDept[e.dept]||0)+1;});
                var dStat={};employees.forEach(function(e){dStat[e.status]=(dStat[e.status]||0)+1;});
                var rows1 = [["Department","Count"]].concat(Object.keys(dDept).map(function(k){return [k,dDept[k]];}));
                var rows2 = [["Status","Count"]].concat(Object.keys(dStat).map(function(k){return [k,dStat[k]];}));
                var all = rows1.concat([[]]).concat(rows2);
                rptDownload(toCsv(all),"Headcount_"+selYr+".csv","text/csv;charset=utf-8");
              }}
            />
          </div>
          <div style={S.g2m}>
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>By Department</div>
            {(function(){var d={};employees.forEach(function(e){d[e.dept]=(d[e.dept]||0)+1;});return Object.keys(d).map(function(k){return(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid "+C.border+"44"}}>
                <span style={S.ts13}>{k}</span><span style={{color:C.accent,fontWeight:700}}>{d[k]}</span>
              </div>            );});}())}
          </Card>
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>By Status</div>
            {(function(){var d={};employees.forEach(function(e){d[e.status]=(d[e.status]||0)+1;});return Object.keys(d).map(function(k){return(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid "+C.border+"44"}}>
                <span style={S.ts13}>{k}</span><StatusChip s={k} />
              </div>            );});}())}
          </Card>
          </div>
        </div>
      )}
      {rptTab === "formEA" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={S.tp14b}>Borang EA / CP8A - {selYr}</div>
              <div style={{color:C.ts,fontSize:12,marginTop:2}}>Individual employee income statements. Issue to all staff by 28 February each year (s83 Employment Act).</div>
            </div>
            <ReportExportBar
              onPDF={function(){
                var tbody = employees.map(function(e,i){
                  var r=rows.find(function(r){return r.empId===e.id;})||{};
                  return '<tr><td style="font-family:monospace">'+(e.empNo||e.id)+'</td><td>'+e.name+'</td><td>'+e.dept+'</td><td>'+e.nric+'</td><td class="r" style="color:#059669;font-weight:700">'+rm2((r.grossTotal||0)*12)+'</td><td class="r" style="color:#7C3AED">'+rm2((r.pcb||0)*12)+'</td><td class="r" style="color:#0EA5C9">'+rm2((r.epfEe||0)*12)+'</td></tr>';
                }).join("");
                var html = printReportHTML("Borang EA Summary (CP8A)",
                  '<table><tr style="background:#0D1226;color:#fff"><th>Emp No</th><th>Name</th><th>Dept</th><th>NRIC</th><th class="r">Annual Gross</th><th class="r">PCB</th><th class="r">EPF (EE)</th></tr><tbody>'+tbody+'</tbody></table>',
                  co.name||"HRCloud",selYr);
                rptDownload(html,"BorangEA_Summary_"+selYr+".html","text/html;charset=utf-8");
              }}
              onExcel={function(){
                var hdr = ["Emp No","Name","Dept","NRIC","EPF No","SOCSO No","Tax No","Annual Gross","PCB","EPF EE","SOCSO EE","Net Annual"];
                var data = employees.map(function(e,i){
                  var r=rows.find(function(r){return r.empId===e.id;})||{};
                  var gross=(r.grossTotal||0)*12;
                  var pcb=(r.pcb||0)*12;
                  var epf=(r.epfEe||0)*12;
                  var socso=(r.socsoEe||0)*12;
                  return [e.empNo||e.id,e.name,e.dept,e.nric||"",e.epfNo||"",e.socsoNo||"",e.taxNo||"",gross.toFixed(2),pcb.toFixed(2),epf.toFixed(2),socso.toFixed(2),(gross-pcb-epf-socso).toFixed(2)];
                });
                rptDownload(toCsv([hdr].concat(data)),"BorangEA_Summary_"+selYr+".csv","text/csv;charset=utf-8");
              }}
            />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
            {employees.map(function(emp){
              var r = rows.find(function(r){return r.empId===emp.id;}) || {};
              return(
                <div key={emp.id} style={{background:C.card,border:"1.5px solid "+C.border,borderRadius:12,padding:"14px 16px",borderTop:"3px solid #1E40AF"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <Avatar name={emp.name} size={32} />
                    <div>
                      <div style={S.tp13b}>{emp.name}</div>
                      <div style={S.ts10}>{emp.empNo||emp.id} - {emp.dept}</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                    {[
                      ["Annual Gross", rm2((r.grossTotal||0)*12), "#059669"],
                      ["PCB Deducted", rm2((r.pcb||0)*12), "#7C3AED"],
                      ["EPF (EE)",     rm2((r.epfEe||0)*12), "#0EA5C9"],
                      ["Net Income",   rm2(((r.grossTotal||0)-(r.epfEe||0)-(r.socsoEe||0)-(r.pcb||0))*12), C.tp],
                    ].map(function(item){return(
                      <div key={item[0]} style={{background:C.surface,borderRadius:6,padding:"5px 8px"}}>
                        <div style={S.ts9b}>{item[0]}</div>
                        <div style={{color:item[2],fontWeight:700,fontSize:11,marginTop:1}}>{item[1]}</div>
                      </div>                    );})}
                  </div>
                  <button onClick={function(){setSelEA(emp); setEaLang("EN");}} style={{width:"100%",background:"linear-gradient(135deg,#1E40AF,#1D4ED8)",color:"#fff",border:"none",borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    👁 Preview &amp; Download
                  </button>
                </div>              );
            })}
          </div>
        </div>
      )}
      {rptTab === "formE" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div>
              <div style={S.tp14b}>Borang E / CP8 - {selYr}</div>
              <div style={{color:C.ts,fontSize:12,marginTop:2}}>Employer Return to LHDN. Due 31 March annually. Required by s83(1) Income Tax Act 1967.</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <ReportExportBar
                onPDF={function(){
                  var html = generateFormEHTML(employees, co, selYr);
                  rptDownload(html,"FormE_CP8_"+selYr+".html","text/html;charset=utf-8");
                }}
                onExcel={function(){
                  var hdr = ["Emp No","Name","NRIC","Tax File No","Annual Gross (RM)","PCB (RM)","EPF No","SOCSO No","Dept","Position"];
                  var data = employees.map(function(e,i){
                    var r=rows[i]||{};
                    return [e.empNo||e.id,e.name,e.nric||"",e.taxNo||"",(r.grossTotal*12).toFixed(2),(r.pcb*12).toFixed(2),e.epfNo||"",e.socsoNo||"",e.dept,e.position||e.role||""];
                  });
                  rptDownload(toCsv([hdr].concat(data)),"BorangE_"+selYr+".csv","text/csv;charset=utf-8");
                }}
              />
              <button onClick={function(){setShowFormE(true);}} style={{background:"linear-gradient(135deg,#DC2626,#B91C1C)",color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                View Full Borang E
              </button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
            {[
              ["Total Employees",employees.length,"#1E40AF"],
              ["Total Gross (Annual)",rm2(rows.reduce(function(s,r){return s+r.grossTotal*12;},0)),"#059669"],
              ["Total PCB Deducted",rm2(rows.reduce(function(s,r){return s+r.pcb*12;},0)),"#7C3AED"],
              ["Total EPF (EE)",rm2(rows.reduce(function(s,r){return s+r.epfEe*12;},0)),"#0EA5C9"],
            ].map(function(item){return(
              <Card key={item[0]} style={{textAlign:"center",borderTop:"3px solid "+item[2]}}>
                <div style={{color:item[2],fontWeight:900,fontSize:20}}>{item[0]}</div>
                <div style={{color:C.ts,fontSize:10,marginTop:3}}>{item[1]}</div>
              </Card>            );})}
          </div>
          <Card noPad style={{overflow:"hidden"}}>
            <div style={{padding:"10px 16px",background:C.surface,borderBottom:"1px solid "+C.border,fontWeight:700,color:C.tp,fontSize:12}}>Employee Summary for Borang E</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{background:C.surface}}>
                    {["Emp No","Name","NRIC","Tax File No","Annual Gross","PCB","EPF No"].map(function(h){return(
                      <th key={h} style={{padding:"8px 10px",textAlign:["Annual Gross","PCB"].includes(h)?"right":"left",color:C.ts,fontWeight:700,borderBottom:"1px solid "+C.border}}>{h}</th>                    );})}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(function(e,i){
                    var r = rows[i];
                    return(
                      <tr key={e.id} style={{borderBottom:"1px solid "+C.border+"33",background:i%2===0?"transparent":"#F8FCFF"}}>
                        <td style={{padding:"7px 10px",fontFamily:"monospace",color:C.ts}}>{e.empNo||e.id}</td>
                        <td style={{padding:"7px 10px",fontWeight:600,color:C.tp}}>{e.name}</td>
                        <td style={{padding:"7px 10px",fontFamily:"monospace",color:C.ts}}>{e.nric||"-"}</td>
                        <td style={{padding:"7px 10px",color:C.ts}}>{e.taxNo||"-"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:C.green,fontWeight:700}}>{rm2(r.grossTotal*12)}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:C.purple,fontWeight:700}}>{rm2(r.pcb*12)}</td>
                        <td style={{padding:"7px 10px",color:C.ts}}>{e.epfNo||"-"}</td>
                      </tr>                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>  );
}

// -- BANK FILES MODULE
function BankModule() {
  var bankFiles = [
    {bank:"Maybank",format:"GIRO Fixed Width (.txt)",count:98,amount:"RM 498,200",status:"Ready"},
    {bank:"CIMB",format:"BizChannel CSV",count:87,amount:"RM 442,600",status:"Ready"},
    {bank:"RHB",format:"Reflex Upload (.txt)",count:62,amount:"RM 299,200",status:"Pending Approval"},
  ];
  return (
    <div>
      <SectionHead title="Bank Files" sub="Generate and download bank disbursement files" />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
        {bankFiles.map(function(b,i) {
          return (
            <Card key={i} style={{borderTop:"3px solid "+(b.status==="Ready"?C.green:C.amber)}}>
              <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:4}}>{b.bank}</div>
              <div style={{color:C.ts,fontSize:12,marginBottom:10}}>{b.format}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <div style={S.ts11}>Transactions</div>
                  <div style={{color:C.tp,fontWeight:700}}>{b.count}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={S.ts11}>Amount</div>
                  <div style={{color:C.green,fontWeight:700}}>{b.amount}</div>
                </div>
              </div>
              <div style={S.rowJSB}>
                <StatusChip s={b.status} />
                {b.status==="Ready" && <Btn sm c={C.accent}>Download</Btn>}
              </div>
            </Card>          );
        })}
      </div>
    </div>  );
}

// -- ORG HIERARCHY MODULE
// ── Org Hierarchy — drag-and-drop restructuring ──────────────────────────────
function HierarchyModule(props) {
  var employees    = props.employees    || [];
  var setEmployees = props.setEmployees || function(){};

  // local copy of manager assignments so we can edit without saving immediately
  var [managerMap, setManagerMap] = useState(function() {
    var m = {};
    employees.forEach(function(e) { m[e.id] = e.managerId || null; });
    return m;
  });
  var [dragId,   setDragId]   = useState(null);   // id being dragged
  var [overId,   setOverId]   = useState(null);   // id of drop target
  var [editEmp,  setEditEmp]  = useState(null);   // employee being edited in side panel
  var [saved,    setSaved]    = useState(false);
  var [search,   setSearch]   = useState("");
  var [expandAll, setExpandAll] = useState(true);
  var [collapsed, setCollapsed] = useState({});    // {empId: true} = collapsed

  // Sync managerMap when employees prop changes (e.g. new hire added elsewhere)
  var empIds = employees.map(function(e){return e.id;}).join(",");
  useState(function(){
    var m = {};
    employees.forEach(function(e){ m[e.id] = e.managerId || null; });
    setManagerMap(m);
  });

  // Build tree from managerMap
  var getChildren = function(parentId) {
    return employees.filter(function(e) {
      return (managerMap[e.id]||null) === (parentId||null);
    });
  };
  var roots = getChildren(null);

  // Depth of a node
  var getDepth = function(id, depth) {
    depth = depth || 0;
    var mgr = managerMap[id];
    if (!mgr) return depth;
    return getDepth(mgr, depth + 1);
  };

  // Would making 'targetId' the manager of 'dragId' create a cycle?
  var wouldCycle = function(draggedId, newManagerId) {
    if (!newManagerId) return false;
    if (newManagerId === draggedId) return true;
    var cur = newManagerId;
    var visited = new Set();
    while (cur) {
      if (visited.has(cur)) return true;
      visited.add(cur);
      if (cur === draggedId) return true;
      cur = managerMap[cur];
    }
    return false;
  };

  // Handlers
  var onDragStart = function(e, empId) {
    setDragId(empId);
    e.dataTransfer.effectAllowed = "move";
  };
  var onDragOver = function(e, targetId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (targetId !== overId) setOverId(targetId);
  };
  var onDragLeave = function() { setOverId(null); };
  var onDrop = function(e, targetId) {
    e.preventDefault();
    setOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    if (wouldCycle(dragId, targetId)) { setDragId(null); return; }
    setManagerMap(function(prev) {
      var n = Object.assign({}, prev);
      n[dragId] = targetId === "__root__" ? null : targetId;
      return n;
    });
    setSaved(false);
    setDragId(null);
  };
  var onDragEnd = function() { setDragId(null); setOverId(null); };

  // Save changes back to employees
  var handleSave = function() {
    setEmployees(function(prev) {
      return prev.map(function(e) {
        return Object.assign({}, e, { managerId: managerMap[e.id] || undefined });
      });
    });
    setSaved(true);
    setTimeout(function(){ setSaved(false); }, 2500);
  };

  // Discard
  var handleDiscard = function() {
    var m = {};
    employees.forEach(function(e){ m[e.id] = e.managerId || null; });
    setManagerMap(m);
    setSaved(false);
  };

  // Toggle collapse
  var toggleCollapse = function(id) {
    setCollapsed(function(prev) {
      var n = Object.assign({}, prev);
      n[id] = !n[id];
      return n;
    });
  };

  // Expand/collapse all
  var handleExpandAll = function(val) {
    setExpandAll(val);
    if (val) { setCollapsed({}); }
    else {
      var m = {};
      employees.forEach(function(e){ m[e.id] = true; });
      setCollapsed(m);
    }
  };

  // Edit save
  var handleEditSave = function(updated) {
    setEmployees(function(prev) {
      return prev.map(function(e){ return e.id === updated.id ? Object.assign({}, e, updated) : e; });
    });
    setManagerMap(function(prev) {
      var n = Object.assign({}, prev);
      n[updated.id] = updated.managerId || null;
      return n;
    });
    setEditEmp(null);
  };

  // Filtered employees for search highlight
  var searchLower = search.toLowerCase();
  var isMatch = function(e) {
    if (!search) return false;
    return (e.name||"").toLowerCase().includes(searchLower) ||
           (e.dept||"").toLowerCase().includes(searchLower) ||
           (e.position||e.role||"").toLowerCase().includes(searchLower);
  };

  // Dept color map
  var deptColors = {};
  var deptPalette = [C.accent, C.green, C.purple, C.amber, "#0EA5C9", "#EC4899", "#14B8A6", "#F97316"];
  var deptList = [];
  employees.forEach(function(e){ if (e.dept && !deptColors[e.dept]) { deptColors[e.dept] = deptPalette[deptList.length % deptPalette.length]; deptList.push(e.dept); } });

  // ── Recursive tree node ──
  function OrgNode(p) {
    var emp      = p.emp;
    var depth    = p.depth || 0;
    var children = getChildren(emp.id);
    var isDragging = dragId === emp.id;
    var isOver   = overId  === emp.id;
    var isCollapsed = collapsed[emp.id];
    var match    = isMatch(emp);
    var mgr      = employees.find(function(e){ return e.id === managerMap[emp.id]; });
    var dColor   = deptColors[emp.dept] || C.accent;

    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
        {/* Node card */}
        <div
          draggable
          onDragStart={function(e){ onDragStart(e, emp.id); }}
          onDragOver={function(e){ onDragOver(e, emp.id); }}
          onDragLeave={onDragLeave}
          onDrop={function(e){ onDrop(e, emp.id); }}
          onDragEnd={onDragEnd}
          onClick={function(){ setEditEmp(emp); }}
          style={{
            width:150, padding:"10px 10px 8px",
            background: isOver ? "#EEF4FF" : (isDragging ? "#F0F4FF" : C.card),
            border:"2px solid "+(isOver ? C.accent : (isDragging ? C.accent+"88" : (match ? C.amber : dColor+"44"))),
            borderRadius:12,
            boxShadow: isOver ? "0 0 0 3px "+C.accent+"44" : (isDragging ? "0 4px 20px rgba(79,110,247,.25)" : "0 2px 8px rgba(0,0,0,.07)"),
            cursor:"grab",
            opacity: isDragging ? 0.5 : 1,
            transition:"border-color .15s, box-shadow .15s",
            position:"relative",
            userSelect:"none",
          }}
        >
          {/* Drag handle indicator */}
          <div style={{position:"absolute",top:5,right:7,color:C.tm,fontSize:11,letterSpacing:1}}>⠿</div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <Avatar name={emp.name} size={36} />
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.tp,lineHeight:1.2,marginBottom:2,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{emp.name}</div>
              <div style={{fontSize:9,color:C.ts,lineHeight:1.3,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{emp.position||emp.role||""}</div>
              <div style={{marginTop:4,background:dColor+"22",color:dColor,fontSize:8,fontWeight:700,padding:"1px 7px",borderRadius:10,display:"inline-block"}}>{emp.dept||""}</div>
            </div>
          </div>
          {children.length > 0 && (
            <div
              onClick={function(e){ e.stopPropagation(); toggleCollapse(emp.id); }}
              style={{position:"absolute",bottom:-11,left:"50%",transform:"translateX(-50%)",width:20,height:20,borderRadius:"50%",background:C.accent,color:"#fff",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:2,boxShadow:"0 1px 4px rgba(0,0,0,.2)",lineHeight:1}}
            >
              {isCollapsed ? "+" : "−"}
            </div>
          )}
        </div>

        {/* Children */}
        {!isCollapsed && children.length > 0 && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
            {/* Vertical line down */}
            <div style={{width:2,height:20,background:C.border}} />
            {/* Horizontal bar */}
            {children.length > 1 && (
              <div style={{position:"relative",display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
                <div style={{
                  position:"absolute", top:0,
                  left: "calc(50% - "+ Math.floor((children.length-1)/2) * 83 +"px - 82px)",
                  width: (children.length - 1) * 166 + 150 + "px",
                  height:2, background:C.border,
                  display: children.length > 1 ? "block" : "none"
                }} />
              </div>
            )}
            <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
              {children.map(function(child) {
                return (
                  <div key={child.id} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                    <div style={{width:2,height:20,background:C.border}} />
                    <OrgNode emp={child} depth={depth+1} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Edit panel
  function EditPanel() {
    var e = editEmp;
    if (!e) return null;
    var children = getChildren(e.id);
    var mgr = employees.find(function(x){ return x.id === managerMap[e.id]; });
    var potentialMgrs = employees.filter(function(x){ return x.id !== e.id && !wouldCycle(e.id, x.id); });
    var [selMgr, setSelMgr] = useState(managerMap[e.id] || "");

    var applyMgrChange = function() {
      setManagerMap(function(prev) {
        var n = Object.assign({}, prev);
        n[e.id] = selMgr || null;
        return n;
      });
      setSaved(false);
      setEditEmp(null);
    };

    return (
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:320,background:C.card,boxShadow:"-4px 0 24px rgba(0,0,0,.15)",zIndex:2000,display:"flex",flexDirection:"column",borderLeft:"1px solid "+C.border}}>
        {/* Header */}
        <div style={{padding:"16px 18px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.accentL}}>
          <div>
            <div style={S.tp14b}>Edit Reporting Line</div>
            <div style={{color:C.ts,fontSize:11,marginTop:2}}>Drag or reassign manager</div>
          </div>
          <button onClick={function(){setEditEmp(null);}} style={{background:"transparent",border:"none",fontSize:18,cursor:"pointer",color:C.ts,padding:4}}>✕</button>
        </div>

        {/* Employee info */}
        <div style={{padding:"18px 18px 14px",borderBottom:"1px solid "+C.border}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <Avatar name={e.name} size={44} />
            <div>
              <div style={S.tp14b}>{e.name}</div>
              <div style={{color:C.ts,fontSize:11}}>{e.position||e.role} · {e.dept}</div>
              <div style={{color:C.ts,fontSize:10,marginTop:2}}>ID: {e.empNo||e.id}</div>
            </div>
          </div>

          {/* Current reporting chain */}
          <div style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.tp,marginBottom:6}}>Current reporting to</div>
            {mgr ? (
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Avatar name={mgr.name} size={26} />
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:C.tp}}>{mgr.name}</div>
                  <div style={{fontSize:10,color:C.ts}}>{mgr.position||mgr.role}</div>
                </div>
              </div>
            ) : (
              <div style={{fontSize:11,color:C.ts,fontStyle:"italic"}}>No manager (top-level)</div>
            )}
          </div>

          {/* Direct reports */}
          {children.length > 0 && (
            <div style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:C.tp,marginBottom:6}}>Direct reports ({children.length})</div>
              {children.map(function(c){
                return (
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                    <Avatar name={c.name} size={22} />
                    <div style={{fontSize:10,color:C.tp}}>{c.name} <span style={{color:C.ts}}>· {c.position||c.role}</span></div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Change manager */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.tp,marginBottom:6}}>Reassign manager to</div>
            <select
              value={selMgr}
              onChange={function(ev){ setSelMgr(ev.target.value); }}
              style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid "+C.border,fontSize:12,background:C.card,color:C.tp,fontFamily:"inherit"}}
            >
              <option value="">— No manager (top-level) —</option>
              {potentialMgrs.map(function(m){
                return <option key={m.id} value={m.id}>{m.name} ({m.position||m.role})</option>;
              })}
            </select>
          </div>

          <button
            onClick={applyMgrChange}
            style={{width:"100%",background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",color:"#fff",border:"none",borderRadius:8,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
          >
            ✓ Apply Change
          </button>
        </div>

        {/* Dept & role quick-edit */}
        <div style={{padding:"14px 18px",flex:1,overflowY:"auto"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.tp,marginBottom:10}}>Quick Edit Info</div>
          {[
            ["Position / Title", "position", e.position||e.role||""],
            ["Department",       "dept",     e.dept||""],
            ["Grade",            "grade",    e.grade||""],
          ].map(function(f){
            return (
              <div key={f[0]} style={{marginBottom:10}}>
                <div style={{fontSize:10,color:C.ts,marginBottom:3}}>{f[0]}</div>
                <input
                  defaultValue={f[2]}
                  id={"qe-"+f[1]}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,fontFamily:"inherit",background:C.surface,color:C.tp}}
                />
              </div>
            );
          })}
          <button
            onClick={function(){
              var updated = Object.assign({}, e, {
                position: document.getElementById("qe-position").value || e.position,
                dept:     document.getElementById("qe-dept").value     || e.dept,
                grade:    document.getElementById("qe-grade").value    || e.grade,
              });
              handleEditSave(updated);
            }}
            style={{width:"100%",background:C.surface,color:C.accent,border:"1.5px solid "+C.accent,borderRadius:8,padding:"8px 0",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:4}}
          >
            Save Info Changes
          </button>
        </div>
      </div>
    );
  }

  // "Drop here as top-level" zone
  var isOverRoot = overId === "__root__";

  return (
    <div>
      <SectionHead title="Org Hierarchy" sub="Drag nodes to restructure · Click to edit reporting line" />

      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <input
          value={search} onChange={function(e){ setSearch(e.target.value); }}
          placeholder="Search by name, dept, role…"
          style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid "+C.border,fontSize:12,fontFamily:"inherit",background:C.card,color:C.tp,width:220}}
        />
        <button onClick={function(){handleExpandAll(true);}} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid "+C.border,background:C.card,color:C.ts,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>⊞ Expand All</button>
        <button onClick={function(){handleExpandAll(false);}} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid "+C.border,background:C.card,color:C.ts,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>⊟ Collapse All</button>
        <div style={{flex:1}} />
        {/* Dept legend */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {deptList.slice(0,6).map(function(d){
            return <span key={d} style={{fontSize:10,padding:"2px 9px",borderRadius:10,background:deptColors[d]+"22",color:deptColors[d],fontWeight:700}}>{d}</span>;
          })}
        </div>
        <button
          onClick={handleDiscard}
          style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid "+C.border,background:C.card,color:C.ts,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
        >↺ Discard</button>
        <button
          onClick={handleSave}
          style={{padding:"8px 18px",borderRadius:8,border:"none",background:saved?"#059669":"linear-gradient(135deg,"+C.accent+","+C.accentD+")",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,transition:"background .2s"}}
        >
          {saved ? "✓ Saved!" : "💾 Save Changes"}
        </button>
      </div>

      {/* Instruction banner */}
      <div style={{background:"#EEF1FE",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:11,color:C.accent,display:"flex",alignItems:"center",gap:8,border:"1px solid "+C.accent+"33"}}>
        <span style={{fontSize:16}}>💡</span>
        <span><b>Drag</b> any card onto another to reassign reporting line. <b>Click</b> a card to edit details. Drop onto <b>"Set as Top-level"</b> zone to remove manager. Hit <b>Save Changes</b> to apply.</span>
      </div>

      {/* Drop zone: set as root */}
      <div
        onDragOver={function(e){ onDragOver(e,"__root__"); }}
        onDragLeave={onDragLeave}
        onDrop={function(e){ onDrop(e,"__root__"); }}
        style={{
          border:"2px dashed "+(isOverRoot?C.accent:C.border),
          borderRadius:10, padding:"10px 18px", marginBottom:18,
          background:isOverRoot?C.accentL:"transparent",
          color:isOverRoot?C.accent:C.tm, fontSize:12, fontWeight:600,
          textAlign:"center", transition:"all .15s",
        }}
      >
        {isOverRoot ? "⬇ Drop here to set as top-level (no manager)" : "🏳 Drop here to set as Top-level"}
      </div>

      {/* Chart canvas */}
      <div style={{overflowX:"auto",overflowY:"auto",background:C.surface,borderRadius:12,border:"1px solid "+C.border,padding:"32px 24px",minHeight:300}}>
        {roots.length === 0 ? (
          <div style={{textAlign:"center",color:C.ts,padding:40}}>No employees found.</div>
        ) : (
          <div style={{display:"flex",gap:24,alignItems:"flex-start",justifyContent:"center",flexWrap:"wrap"}}>
            {roots.map(function(r){
              return (
                <div key={r.id} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <OrgNode emp={r} depth={0} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
        {[
          ["Total Employees", employees.length, C.accent],
          ["Top-level / Roots", roots.length, C.green],
          ["Departments", deptList.length, C.purple],
          ["Max Depth", (function(){ var d=0; employees.forEach(function(e){ d=Math.max(d,getDepth(e.id)); }); return d; })(), C.amber],
        ].map(function(s){
          return (
            <div key={s[0]} style={{background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"8px 16px",display:"flex",gap:10,alignItems:"center"}}>
              <span style={{color:s[2],fontWeight:800,fontSize:18}}>{s[1]}</span>
              <span style={{color:C.ts,fontSize:11}}>{s[0]}</span>
            </div>
          );
        })}
      </div>

      {/* Edit side panel */}
      {editEmp && <EditPanel />}
    </div>
  );
}

// -- PERMISSIONS MODULE
function PermissionsModule(props) {
  var employees = props.employees || [];
  var rolePerms = props.rolePerms || {};
  var setRolePerms = props.setRolePerms || function(){};
  var roles = Object.keys(ROLE_PRESETS);
  var [selRole, setSelRole] = useState("HR Manager");
  var perms = rolePerms[selRole] || new Set();

  var toggle = function(moduleId) {
    setRolePerms(function(prev) {
      var current = new Set(prev[selRole] || []);
      if (current.has(moduleId)) { current.delete(moduleId); } else { current.add(moduleId); }
      var np = Object.assign({}, prev); np[selRole] = current; return np;
    });
  };

  return (
    <div>
      <SectionHead title="Permissions" sub="Role-based access control for all modules" />
      <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:16}}>
        <Card noPad style={{overflow:"hidden"}}>
          {roles.map(function(role, i) {
            return (
              <div key={role} onClick={function(){setSelRole(role);}}
                style={{padding:"12px 14px",cursor:"pointer",
                  background:selRole===role?C.accentL:"transparent",
                  borderBottom:i<roles.length-1?"1px solid "+C.border+"55":"none"}}>
                <div style={S.rowJSB}>
                  <span style={{color:selRole===role?C.accent:C.tp,fontWeight:600,fontSize:13}}>{role}</span>
                  <span style={S.ts11}>{(rolePerms[role]||new Set()).size} modules</span>
                </div>
              </div>            );
          })}
        </Card>
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>Access for: {selRole}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {ALL_MODULES.map(function(mod) {
              var hasAccess = perms.has(mod.id);
              return (
                <div key={mod.id} onClick={function(){toggle(mod.id);}}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",
                    background:hasAccess?C.greenL:C.surface,
                    border:"1.5px solid "+(hasAccess?C.green+"55":C.border),
                    borderRadius:8,cursor:"pointer",transition:"all .12s"}}>
                  <span style={{display:"flex",alignItems:"center",flexShrink:0,color:hasAccess?C.green:C.ts}}>{mod.icon}</span>
                  <span style={{color:hasAccess?C.green:C.ts,fontSize:12,fontWeight:600}}>{mod.label}</span>
                </div>              );
            })}
          </div>
        </Card>
      </div>
    </div>  );
}

// -- HR CONFIG DATA (Departments, Grades, Roles, Employment Types, Statuses, Leave)
var INIT_HR_CONFIG = {
  departments:     ["Finance","HR","IT","Sales","Operations","Marketing","Legal","Customer Service"],
  grades:          ["G1","G2","G3","G4","G5","G6","M1","M2","M3"],
  roles:           ["Staff","Senior Staff","Executive","Senior Executive","Manager","Senior Manager","Director","Head of Department"],
  employmentTypes: ["Permanent","Contract","Part-Time","Internship","Probation"],
  statuses:        ["Active","Probation","Resigned","Terminated","Retired","On Leave"],
};

// Leave entitlement defaults per Employment Act 1955 (Malaysia)
var INIT_LEAVE_CONFIG = {
  leaveTypes: [
    {id:"AL",  name:"Annual Leave",         paid:true,  carry:true,  maxCarry:8,  requireDoc:false, color:"#0EA5C9"},
    {id:"SL",  name:"Sick Leave",           paid:true,  carry:false, maxCarry:0,  requireDoc:true,  color:"#059669"},
    {id:"HL",  name:"Hospitalisation Leave",paid:true,  carry:false, maxCarry:0,  requireDoc:true,  color:"#7C3AED"},
    {id:"ML",  name:"Maternity Leave",      paid:true,  carry:false, maxCarry:0,  requireDoc:true,  color:"#EC4899"},
    {id:"PL",  name:"Paternity Leave",      paid:true,  carry:false, maxCarry:0,  requireDoc:true,  color:"#3B82F6"},
    {id:"EL",  name:"Emergency Leave",      paid:true,  carry:false, maxCarry:0,  requireDoc:false, color:"#DC2626"},
    {id:"UL",  name:"Unpaid Leave",         paid:false, carry:false, maxCarry:0,  requireDoc:false, color:"#94A3B8"},
    {id:"RPL", name:"Replacement Leave",    paid:true,  carry:true,  maxCarry:3,  requireDoc:false, color:"#D97706"},
  ],
  // Entitlement by employment type + years of service
  // Annual leave (Employment Act s60E) & Sick leave (s60F)
  entitlements: [
    {
      empType:"Permanent",
      tiers:[
        {label:"< 2 years",   minYrs:0, maxYrs:2,  AL:8,  SL:14, HL:60, ML:98, PL:7,  EL:3, RPL:0},
        {label:"2 - 5 years", minYrs:2, maxYrs:5,  AL:12, SL:18, HL:60, ML:98, PL:7,  EL:3, RPL:0},
        {label:"> 5 years",   minYrs:5, maxYrs:999, AL:16, SL:22, HL:60, ML:98, PL:7,  EL:3, RPL:0},
      ]
    },
    {
      empType:"Contract",
      tiers:[
        {label:"< 2 years",   minYrs:0, maxYrs:2,  AL:8,  SL:14, HL:60, ML:98, PL:7,  EL:2, RPL:0},
        {label:"> 2 years",   minYrs:2, maxYrs:999, AL:12, SL:18, HL:60, ML:98, PL:7,  EL:2, RPL:0},
      ]
    },
    {
      empType:"Part-Time",
      tiers:[
        {label:"All",         minYrs:0, maxYrs:999, AL:4,  SL:7,  HL:30, ML:0,  PL:0,  EL:1, RPL:0},
      ]
    },
    {
      empType:"Internship",
      tiers:[
        {label:"All",         minYrs:0, maxYrs:999, AL:0,  SL:7,  HL:0,  ML:0,  PL:0,  EL:0, RPL:0},
      ]
    },
    {
      empType:"Probation",
      tiers:[
        {label:"All",         minYrs:0, maxYrs:999, AL:8,  SL:14, HL:60, ML:98, PL:7,  EL:3, RPL:0},
      ]
    },
  ],
  // Public holidays (Malaysia 2025 - national + common state)
  publicHolidays: [
    {id:"ph01", date:"2025-01-01", name:"New Year's Day",          type:"National",  compulsory:true},
    {id:"ph02", date:"2025-01-29", name:"Chinese New Year Day 1",  type:"National",  compulsory:true},
    {id:"ph03", date:"2025-01-30", name:"Chinese New Year Day 2",  type:"National",  compulsory:true},
    {id:"ph04", date:"2025-02-01", name:"Federal Territory Day",   type:"State",     compulsory:false},
    {id:"ph05", date:"2025-03-31", name:"Hari Raya Aidilfitri 1",  type:"National",  compulsory:true},
    {id:"ph06", date:"2025-04-01", name:"Hari Raya Aidilfitri 2",  type:"National",  compulsory:true},
    {id:"ph07", date:"2025-04-18", name:"Good Friday",             type:"State",     compulsory:false},
    {id:"ph08", date:"2025-05-01", name:"Labour Day",              type:"National",  compulsory:true},
    {id:"ph09", date:"2025-05-12", name:"Wesak Day",               type:"National",  compulsory:true},
    {id:"ph10", date:"2025-06-02", name:"Yang di-Pertuan Agong Birthday", type:"National", compulsory:true},
    {id:"ph11", date:"2025-06-07", name:"Hari Raya Haji",          type:"National",  compulsory:true},
    {id:"ph12", date:"2025-08-31", name:"National Day",            type:"National",  compulsory:true},
    {id:"ph13", date:"2025-09-16", name:"Malaysia Day",            type:"National",  compulsory:true},
    {id:"ph14", date:"2025-10-20", name:"Deepavali",               type:"National",  compulsory:true},
    {id:"ph15", date:"2025-12-25", name:"Christmas Day",           type:"National",  compulsory:true},
  ],
  // Leave policy settings
  policy: {
    leaveYear:          "calendar",   // "calendar" | "anniversary"
    leaveYearStart:     "01-01",      // mm-dd, for calendar year
    proRata:            true,         // prorate for new joiners
    halfDayAllowed:     true,
    advanceLeave:       false,        // allow borrowing next year entitlement
    leaveApproval:      "manager",    // "manager" | "hr" | "both"
    medCertRequired:    2,            // sick days threshold requiring MC
    replacementPolicy:  "manager",    // who approves replacement leave
    phInLieuAllowed:    true,         // replacement if PH falls on off day
    phCompulsoryDays:   11,           // minimum PH days per Employment Act
  },
};

// -- PAYROLL & ATTENDANCE CONFIG
var INIT_PAYROLL_CONFIG = {
  // Payroll cutoff
  cutoffDay:        26,           // day of month payroll data is cut off (e.g. 26 = 26th each month)
  payDay:           5,            // salary payment day of next month
  cutoffType:       "fixed",      // "fixed" | "last" (last working day)
  payPeriod:        "monthly",    // "monthly" | "biweekly"
  currency:         "MYR",
  hrEmail:          "hr@company.com.my",
  managerEmail:     "manager@company.com.my",
  leaveNotifyEmail: "hr@company.com.my",
  leaveApprover:    "HR",

  // Attendance sensitivity
  gracePeriodMin:   10,           // minutes late before it is recorded as late
  lateRounding:     5,            // round late minutes to nearest N minutes
  earlyLeaveMin:    15,           // minutes leaving early before deduction applies

  // Late penalty tiers - applied after grace period
  // type: "none" | "deduct_per_min" | "deduct_fixed" | "half_day" | "full_day" | "warning"
  latePenaltyTiers: [
    {minLateMin:1,   maxLateMin:15,  type:"warning",       amount:0,    label:"1-15 min: Warning only"},
    {minLateMin:16,  maxLateMin:30,  type:"deduct_fixed",  amount:20,   label:"16-30 min: RM20 deduction"},
    {minLateMin:31,  maxLateMin:60,  type:"deduct_per_min",amount:2,    label:"31-60 min: RM2/min"},
    {minLateMin:61,  maxLateMin:120, type:"half_day",      amount:0,    label:"61-120 min: Half day deduction"},
    {minLateMin:121, maxLateMin:999, type:"full_day",      amount:0,    label:">120 min: Full day deduction"},
  ],

  // Waiver rules
  waiverEnabled:      true,
  waiverOccurrences:  1,          // allow N waivers per month per employee
  waiverAutoApply:    false,       // auto-apply waiver or require manual HR action
  waiverNote:         "First late occurrence each month automatically waived per company policy.",

  // Accumulation penalty (optional - escalation)
  escalationEnabled:  false,
  escalationThreshold:3,          // after N late incidents/month, apply escalation
  escalationPenalty:  "warning_letter", // "warning_letter" | "half_day" | "full_day"
};

// -- EMPLOYEE CONFIG MODULE

// -- STAFFING SCHEDULE MODULE// -- STAFFING SCHEDULE MODULE
var DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
var MONTHS_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

var INIT_SHIFT_PRESETS = [
  {id:"morning",  name:"Morning",   start:"08:00",end:"17:00",brk:60,color:"#059669"},
  {id:"afternoon",name:"Afternoon", start:"14:00",end:"23:00",brk:60,color:"#D97706"},
  {id:"night",    name:"Night",     start:"22:00",end:"07:00",brk:60,color:"#7C3AED"},
  {id:"flexible", name:"Flexible",  start:"09:00",end:"18:00",brk:60,color:"#0EA5C9"},
  {id:"off",      name:"Off Day",   start:"",     end:"",     brk:0, color:"#94A3B8"},
];

function calcNetHours(start, end, brk) {
  if (!start || !end) return 0;
  var sp = start.split(":"); var ep = end.split(":");
  var sm = parseInt(sp[0])*60+parseInt(sp[1]);
  var em = parseInt(ep[0])*60+parseInt(ep[1]);
  if (em <= sm) em += 24*60;
  var net = (em - sm - (parseInt(brk)||0)) / 60;
  return net > 0 ? net : 0;
}

function getShiftById(id, presets) {
  var list = presets || INIT_SHIFT_PRESETS;
  return list.find(function(s){return s.id===id;}) || list[list.length-1];
}

// Returns array of day-of-week labels for a given month (0=Mon..6=Sun)
// and the calendar grid (6 weeks x 7 days, null = padding)
function buildCalendar(year, month) {
  var firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  var daysInMonth = new Date(year, month+1, 0).getDate();
  // Convert Sun=0 to Mon=0 base
  var offset = (firstDay + 6) % 7;
  var grid = [];
  var day = 1 - offset;
  for (var w = 0; w < 6; w++) {
    var week = [];
    for (var d = 0; d < 7; d++) {
      week.push(day >= 1 && day <= daysInMonth ? day : null);
      day++;
    }
    grid.push(week);
    if (day > daysInMonth) break;
  }
  return grid;
}

// Get day-of-week key (Mon/Tue/...) from a date number + month/year
function getDayKey(year, month, day) {
  var idx = new Date(year, month, day).getDay(); // 0=Sun
  var map = [6,0,1,2,3,4,5]; // Sun->6, Mon->0...
  return DAYS_SHORT[map[idx]];
}

// -- Work Hours Edit Modal (reusable)
function WorkHoursModal(p) {
  var wkForm = p.wkForm;
  var setWkForm = p.setWkForm;
  var empName = p.empName;
  var onSave = p.onSave;
  var onClose = p.onClose;
  var hrs = calcNetHours(wkForm.start, wkForm.end, wkForm.brk);
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <Card style={{width:480,padding:28}}>
        <div style={{color:C.tp,fontWeight:800,fontSize:16,marginBottom:4}}>Working Hours</div>
        <div style={{color:C.ts,fontSize:12,marginBottom:18}}>{empName}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={S.ts11b}>START TIME</label>
            <input type="time" value={wkForm.start||"08:00"} onChange={function(e){setWkForm(function(f){return Object.assign({},f,{start:e.target.value});});}} style={Object.assign({},inputStyle)} />
          </div>
          <div>
            <label style={S.ts11b}>END TIME</label>
            <input type="time" value={wkForm.end||"17:00"} onChange={function(e){setWkForm(function(f){return Object.assign({},f,{end:e.target.value});});}} style={Object.assign({},inputStyle)} />
          </div>
          <div>
            <label style={S.ts11b}>BREAK (min)</label>
            <input type="number" min="0" max="120" value={wkForm.brk||60} onChange={function(e){setWkForm(function(f){return Object.assign({},f,{brk:parseInt(e.target.value)||0});});}} style={Object.assign({},inputStyle)} />
          </div>
          <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",paddingBottom:4}}>
            <div style={{color:C.green,fontWeight:800,fontSize:18}}>{hrs.toFixed(1)} hrs</div>
            <div style={S.ts10}>net/day</div>
          </div>
        </div>
        <div style={{display:"flex",gap:20,marginBottom:18}}>
          <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
            <input type="checkbox" checked={wkForm.flexible||false} onChange={function(e){setWkForm(function(f){return Object.assign({},f,{flexible:e.target.checked});});}} />
            <span style={{color:C.tp,fontSize:13}}>Flexible Hours</span>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
            <input type="checkbox" checked={wkForm.ot||false} onChange={function(e){setWkForm(function(f){return Object.assign({},f,{ot:e.target.checked});});}} />
            <span style={{color:C.tp,fontSize:13}}>OT Eligible</span>
          </label>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn c={C.ts} onClick={onClose}>Cancel</Btn>
          <Btn c={C.green} onClick={onSave}>Save</Btn>
        </div>
      </Card>
    </div>  );
}

// -- Main Schedule Module
function ScheduleModule(props) {
  var employees = props.employees || [];

  // State - local UI only
  var _tab   = useState("roster");  var tab   = _tab[0];  var setTab   = _tab[1];
  var _yr    = useState(2025);      var year  = _yr[0];   var setYear  = _yr[1];
  var _mo    = useState(5);         var month = _mo[0];   var setMonth = _mo[1];
  var _selEmp = useState(null);     var selEmp = _selEmp[0]; var setSelEmp = _selEmp[1];
  var [editModal, setEditModal] = useState(false);
  var [wkForm, setWkForm] = useState({start:"08:00",end:"17:00",brk:60,flexible:false,ot:false});
  var [calView, setCalView] = useState(null);
  var sched        = props.sched        || {};
  var setSched     = props.setSched     || function(){};
  var wh           = props.wh           || {};
  var setWh        = props.setWh        || function(){};
  var unifiedShift = props.unifiedShift || {Mon:"morning",Tue:"morning",Wed:"morning",Thu:"morning",Fri:"morning",Sat:"off",Sun:"off"};
  var setUnifiedShift = props.setUnifiedShift || function(){};
  var mode         = props.schedMode    || "off";
  var setMode      = props.setSchedMode || function(){};
  var shiftPresets    = props.shiftPresets    || INIT_SP;
  var setShiftPresets = props.setShiftPresets || function(){};
  var SP = shiftPresets; // shorthand

  var calGrid = buildCalendar(year, month);

  // Get shift for a specific emp + date
  var getDateShift = function(empId, day) {
    var dateStr = year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
    var dayKey = getDayKey(year, month, day);
    if (mode === "on") {
      // Per employee: check date override first, else use day-of-week default
      var empSched = sched[empId] || {};
      if (empSched[dateStr] !== undefined) return empSched[dateStr];
      var empWh = wh[empId];
      if (!empWh) return "off";
      // Default: Mon-Fri = morning, Sat-Sun = off
      return (dayKey === "Sat" || dayKey === "Sun") ? "off" : "morning";
    } else {
      // Unified: check per-date override, else unified day-of-week
      var empSched2 = sched[empId] || {};
      if (empSched2[dateStr] !== undefined) return empSched2[dateStr];
      return unifiedShift[dayKey] || "off";
    }
  };

  // Set shift for emp + specific date
  var setDateShift = function(empId, day, shiftId) {
    var dateStr = year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
    setSched(function(prev) {
      var updated = Object.assign({}, prev);
      var empSched = Object.assign({}, prev[empId] || {});
      empSched[dateStr] = shiftId;
      updated[empId] = empSched;
      return updated;
    });
  };

  // Prev/next month
  var prevMonth = function() {
    if (month === 0) { setMonth(11); setYear(function(y){return y-1;}); }
    else setMonth(function(m){return m-1;});
  };
  var nextMonth = function() {
    if (month === 11) { setMonth(0); setYear(function(y){return y+1;}); }
    else setMonth(function(m){return m+1;});
  };

  // Open work hours modal for an employee
  var openEdit = function(empId) {
    setSelEmp(empId);
    var existing = wh[empId] || {start:"08:00",end:"17:00",brk:60,flexible:false,ot:false};
    setWkForm(Object.assign({}, existing));
    setEditModal(true);
  };

  var saveEdit = function() {
    var updated = Object.assign({}, wh);
    updated[selEmp] = Object.assign({}, wkForm);
    setWh(updated);
    setEditModal(false);
    setSelEmp(null);
  };

  var empName = selEmp ? ((employees.find(function(e){return e.id===selEmp;})||{}).name||selEmp) : "";

  // Count working days in month for an employee
  var countWorkingDays = function(empId) {
    var count = 0;
    var daysInMonth = new Date(year, month+1, 0).getDate();
    for (var d = 1; d <= daysInMonth; d++) {
      var s = getDateShift(empId, d);
      if (s !== "off") count++;
    }
    return count;
  };

  // Shift color map
  var shiftColor = function(shiftId) {
    var s = getShiftById(shiftId, SP);
    return s.color;
  };

  var TABS = [
    ["roster","Monthly Roster"],
    ["setup","Schedule Setup"],
    ["hours","Work Hours"],
    ["calendar","Team Calendar"],
    ["shiftconfig","Shift Settings"],
  ];

  // Local state for shift settings editing
  var [editShift, setEditShift] = useState(null);
  var [shiftForm, setShiftForm] = useState({});

  var openShiftEdit = function(shift) {
    setEditShift(shift.id);
    setShiftForm(Object.assign({}, shift));
  };

  var saveShiftEdit = function() {
    setShiftPresets(function(prev) {
      return prev.map(function(s) {
        return s.id === editShift ? Object.assign({}, shiftForm) : s;
      });
    });
    setEditShift(null);
  };

  var resetShiftPresets = function() {
    setShiftPresets(INIT_SP.map(function(s){return Object.assign({},s);}));
  };

  return (
    <div>
      <SectionHead title="Staffing Schedule" sub={MONTHS_NAMES[month]+" "+year+" - "+employees.length+" employees"} />

      {editModal && (
        <WorkHoursModal
          wkForm={wkForm} setWkForm={setWkForm}
          empName={empName} onSave={saveEdit}
          onClose={function(){setEditModal(false);}} />
      )}

      {/* Top controls: month picker + mode toggle + tabs */}
      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        {/* Month navigator */}
        <div style={{display:"flex",alignItems:"center",gap:8,background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"6px 10px"}}>
          <button onClick={prevMonth} style={{background:"none",border:"none",color:C.accent,fontSize:16,cursor:"pointer",fontFamily:"inherit",padding:"0 4px"}}>{"<"}</button>
          <select value={month} onChange={function(e){setMonth(parseInt(e.target.value));}} style={Object.assign({},selectStyle,{marginBottom:0,width:110,fontSize:12,padding:"4px 8px"})}>
            {MONTHS_NAMES.map(function(m,i){ return <option key={i} value={i}>{m}</option>; })}
          </select>
          <select value={year} onChange={function(e){setYear(parseInt(e.target.value));}} style={Object.assign({},selectStyle,{marginBottom:0,width:72,fontSize:12,padding:"4px 8px"})}>
            {[2024,2025,2026,2027].map(function(y){ return <option key={y} value={y}>{y}</option>; })}
          </select>
          <button onClick={nextMonth} style={{background:"none",border:"none",color:C.accent,fontSize:16,cursor:"pointer",fontFamily:"inherit",padding:"0 4px"}}>{">"}</button>
        </div>

        {/* Mode toggle */}
        <div style={{display:"flex",alignItems:"center",gap:8,background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"6px 12px"}}>
          <span style={S.ts11b}>SCHEDULE TYPE:</span>
          <button onClick={function(){setMode("off");}} style={{background:mode==="off"?C.green:"transparent",color:mode==="off"?"#fff":C.ts,border:"1.5px solid "+(mode==="off"?C.green:C.border),borderRadius:6,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            OFF - Unified
          </button>
          <button onClick={function(){setMode("on");}} style={{background:mode==="on"?C.accent:"transparent",color:mode==="on"?"#fff":C.ts,border:"1.5px solid "+(mode==="on"?C.accent:C.border),borderRadius:6,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            ON - Per Employee
          </button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          {TABS.map(function(t) {
            return (
              <button key={t[0]} onClick={function(){setTab(t[0]);}} style={{background:tab===t[0]?C.accentL:"transparent",color:tab===t[0]?C.accent:C.ts,border:"1.5px solid "+(tab===t[0]?C.accent+"66":C.border),borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                {t[1]}
              </button>            );
          })}
        </div>
      </div>

      {/* Mode explanation banner */}
      <div style={{marginBottom:14,padding:"10px 14px",borderRadius:8,background:mode==="on"?C.accentL:C.greenL,borderLeft:"4px solid "+(mode==="on"?C.accent:C.green)}}>
        <span style={{color:mode==="on"?C.accent:C.green,fontWeight:700,fontSize:12}}>
          {mode==="on" ? "ON - Per Employee Mode: " : "OFF - Unified Mode: "}
        </span>
        <span style={S.ts12}>
          {mode==="on"
            ? "Each employee has their own schedule. Set individual work hours and shift patterns. Overrides apply per date."
            : "One schedule applies to all employees. Set unified shifts by day-of-week. Individual date overrides still possible."}
        </span>
      </div>

      {/* -- TAB: SETUP */}
      {tab === "setup" && (
        <div>
          {mode === "off" ? (
            <Card>
              <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:4}}>Unified Weekly Schedule</div>
              <div style={{color:C.ts,fontSize:12,marginBottom:18}}>Set one shift pattern that applies to ALL employees. This is the default for every day across all staff.</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10}}>
                {DAYS_SHORT.map(function(day) {
                  var isWknd = day==="Sat"||day==="Sun";
                  var curShift = getShiftById(unifiedShift[day]||"off", SP);
                  return (
                    <div key={day} style={{textAlign:"center"}}>
                      <div style={{color:isWknd?C.amber:C.tp,fontWeight:700,fontSize:12,marginBottom:8}}>{day}</div>
                      <div style={{background:curShift.color+"18",border:"2px solid "+curShift.color+"55",borderRadius:10,padding:"10px 6px",marginBottom:6}}>
                        <div style={{fontSize:18,marginBottom:4}}>
                          {curShift.id==="off"?"🔴":curShift.id==="morning"?"🌅":curShift.id==="afternoon"?"🌆":curShift.id==="night"?"🌙":"🔵"}
                        </div>
                        <div style={{color:curShift.color,fontWeight:700,fontSize:11}}>{curShift.name}</div>
                        {curShift.start && <div style={{color:C.ts,fontSize:9,marginTop:2}}>{curShift.start}-{curShift.end}</div>}
                      </div>
                      <select value={unifiedShift[day]||"off"} onChange={function(e){
                        var v = e.target.value; var d2 = day;
                        setUnifiedShift(function(prev){ var u=Object.assign({},prev); u[d2]=v; return u; });
                      }} style={{width:"100%",background:curShift.color+"11",border:"1.5px solid "+curShift.color+"55",borderRadius:6,padding:"4px 4px",fontSize:10,fontWeight:700,color:curShift.color,cursor:"pointer",fontFamily:"inherit"}}>
                        {SP.map(function(s){ return <option key={s.id} value={s.id}>{s.name}</option>; })}
                      </select>
                    </div>                  );
                })}
              </div>
              <div style={{marginTop:18,padding:"10px 14px",background:C.surface,borderRadius:8,display:"flex",gap:20,flexWrap:"wrap"}}>
                {SP.filter(function(s){return s.start;}).map(function(s){
                  var net = calcNetHours(s.start, s.end, s.brk);
                  return (
                    <div key={s.id} style={S.rowG6}>
                      <div style={{width:10,height:10,borderRadius:2,background:s.color,flexShrink:0}} />
                      <span style={{color:C.tp,fontSize:11,fontWeight:600}}>{s.name}</span>
                      <span style={S.ts10}>{s.start}-{s.end} ({net.toFixed(1)}h)</span>
                    </div>                  );
                })}
              </div>
            </Card>
          ) : (
            <div>
              <div style={{color:C.ts,fontSize:12,marginBottom:12}}>Per-employee mode: set individual working hours and shift assignments. Each employee has their own schedule configuration.</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
                {employees.map(function(emp) {
                  var empWh = wh[emp.id] || {start:"08:00",end:"17:00",brk:60,flexible:false,ot:false};
                  var hrs = calcNetHours(empWh.start, empWh.end, empWh.brk);
                  var workDays = countWorkingDays(emp.id);
                  return (
                    <Card key={emp.id} style={{borderLeft:"4px solid "+(empWh.flexible?C.accent:C.green)}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                        <div style={S.rowG8}>
                          <Avatar name={emp.name} size={32} />
                          <div>
                            <div style={S.tp13b}>{emp.name}</div>
                            <div style={S.ts10}>{emp.dept}</div>
                          </div>
                        </div>
                        <Btn sm c={C.accent} onClick={function(){openEdit(emp.id);}}>Edit Hours</Btn>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                        {[["Start",empWh.start||"--",C.green],["End",empWh.end||"--","#DC2626"],["Net",hrs.toFixed(1)+"h",C.accent]].map(function(item){
                          return (
                            <div key={item[0]} style={{background:C.surface,borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
                              <div style={S.ts9b}>{item[0]}</div>
                              <div style={{color:item[2],fontWeight:700,fontSize:12,marginTop:1}}>{item[1]}</div>
                            </div>                          );
                        })}
                      </div>
                      <div style={S.rowJSB}>
                        <div style={S.rowG6}>
                          {empWh.flexible && <Chip text="Flexible" c={C.accent} />}
                          {empWh.ot && <Chip text="OT" c={C.green} />}
                        </div>
                        <span style={S.ts11}>{workDays} working days this month</span>
                      </div>
                    </Card>                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* -- TAB: ROSTER */}
      {tab === "roster" && (
        <Card noPad style={{overflow:"hidden"}}>
          <div style={{padding:"10px 14px",background:C.surface,borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={S.tp13b}>Monthly Roster - {MONTHS_NAMES[month]} {year}</span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {SP.map(function(s){
                return <span key={s.id} style={{color:s.color,fontSize:10,fontWeight:700,padding:"2px 7px",background:s.color+"18",borderRadius:10}}>{s.name.charAt(0)}</span>;
              })}
              <span style={S.ts10}>=legend</span>
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:C.surface}}>
                  <th style={{padding:"8px 12px",textAlign:"left",color:C.ts,fontWeight:700,borderBottom:"1px solid "+C.border,position:"sticky",left:0,background:C.surface,minWidth:140,zIndex:1}}>Employee</th>
                  {(function(){
                    var daysInMonth = new Date(year,month+1,0).getDate();
                    var cells = [];
                    for (var d = 1; d <= daysInMonth; d++) {
                      var dayKey = getDayKey(year, month, d);
                      var isWknd = dayKey==="Sat"||dayKey==="Sun";
                      var today = new Date(); var isToday = d===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
                      cells.push(
                        <th key={d} style={{padding:"4px 2px",textAlign:"center",color:isWknd?C.amber:C.ts,fontWeight:700,borderBottom:"1px solid "+C.border,minWidth:28,background:isToday?C.accentL:C.surface}}>
                          <div>{d}</div>
                          <div style={{fontSize:8,fontWeight:400,color:isWknd?C.amber:C.tm}}>{dayKey.charAt(0)}</div>
                        </th>                      );
                    }
                    return cells;
                  })()}
                  <th style={{padding:"8px 8px",textAlign:"center",color:C.ts,fontWeight:700,borderBottom:"1px solid "+C.border,minWidth:50}}>Days</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(function(emp,ei) {
                  var daysInMonth = new Date(year,month+1,0).getDate();
                  var workCount = 0;
                  return (
                    <tr key={emp.id} style={{borderBottom:"1px solid "+C.border+"44",background:ei%2===0?"transparent":"#F8FCFF"}}>
                      <td style={{padding:"6px 12px",position:"sticky",left:0,background:ei%2===0?"#fff":"#F8FCFF",zIndex:1}}>
                        <div style={{color:C.tp,fontWeight:700,fontSize:11}}>{emp.preferredName||emp.name.split(" ")[0]}</div>
                        <div style={S.ts9}>{emp.dept}</div>
                      </td>
                      {(function(){
                        var cells = [];
                        for (var d = 1; d <= daysInMonth; d++) {
                          var shiftId = getDateShift(emp.id, d);
                          var shift = getShiftById(shiftId, SP);
                          if (shiftId !== "off") workCount++;
                          var dd = d;
                          cells.push(
                            <td key={d} style={{padding:"3px 2px",textAlign:"center"}}>
                              <select value={shiftId} onChange={function(e){var dv=dd; setDateShift(emp.id,dv,e.target.value);}}
                                title={shift.name+(shift.start?" "+shift.start+"-"+shift.end:"")}
                                style={{width:24,height:22,background:shift.color+"22",border:"1px solid "+shift.color+"66",borderRadius:3,fontSize:9,fontWeight:700,color:shift.color,cursor:"pointer",fontFamily:"inherit",padding:0,textAlign:"center",appearance:"none",WebkitAppearance:"none"}}>
                                {SP.map(function(s){ return <option key={s.id} value={s.id}>{s.name.charAt(0)}</option>; })}
                              </select>
                            </td>                          );
                        }
                        cells.push(
                          <td key="count" style={{padding:"6px 8px",textAlign:"center",fontWeight:700,color:C.accent,fontSize:12}}>
                            {workCount}
                          </td>                        );
                        return cells;
                      })()}
                    </tr>                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:"8px 14px",background:C.surface,borderTop:"1px solid "+C.border,color:C.ts,fontSize:10}}>
            Click any cell to change shift. Hover for shift details. First letter = shift type (M=Morning, A=Afternoon, N=Night, F=Flexible, O=Off).
          </div>
        </Card>
      )}

      {/* -- TAB: WORK HOURS */}
      {tab === "hours" && (
        <div>
          <Card style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <div style={S.tp14b}>Individual Work Hours</div>
                <div style={S.ts12}>Configure start/end/break per employee. Used for payroll daily rate, OT, and late deduction calculations.</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
              {employees.map(function(emp) {
                var empWh = wh[emp.id] || {start:"08:00",end:"17:00",brk:60,flexible:false,ot:false};
                var hrs = calcNetHours(empWh.start, empWh.end, empWh.brk);
                return (
                  <div key={emp.id} style={{border:"1.5px solid "+C.border,borderRadius:10,padding:"12px 14px",borderLeft:"4px solid "+(empWh.flexible?C.accent:C.green)}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div>
                        <div style={S.tp12b}>{emp.name}</div>
                        <div style={S.ts10}>{emp.id} - {emp.dept}</div>
                      </div>
                      <button onClick={function(){openEdit(emp.id);}} style={{background:C.accentL,color:C.accent,border:"none",borderRadius:6,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                      {[["Start",empWh.start,C.green],["End",empWh.end,"#DC2626"],["Break",empWh.brk+"min",C.amber],["Net",hrs.toFixed(1)+"h/day",C.accent]].map(function(r){
                        return (
                          <div key={r[0]} style={{background:C.surface,borderRadius:5,padding:"5px 7px"}}>
                            <div style={{color:C.ts,fontSize:8,fontWeight:700}}>{r[0]}</div>
                            <div style={{color:r[2],fontWeight:700,fontSize:11,marginTop:1}}>{r[1]||"--"}</div>
                          </div>                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:5,marginTop:7}}>
                      {empWh.flexible && <span style={{background:C.accentL,color:C.accent,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8}}>Flexible</span>}
                      {empWh.ot && <span style={{background:C.greenL,color:C.green,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8}}>OT Eligible</span>}
                      {!empWh.ot && <span style={{background:C.surface,color:C.ts,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8}}>No OT</span>}
                    </div>
                  </div>                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* -- TAB: TEAM CALENDAR */}
      {tab === "calendar" && (
        <div>
          {/* Employee filter */}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{color:C.ts,fontSize:12,fontWeight:700}}>View:</span>
            <button onClick={function(){setCalView("all");}} style={{background:calView==="all"?"linear-gradient(135deg,"+C.accent+","+C.accentD+")":C.surface,color:calView==="all"?"#fff":C.ts,border:"1.5px solid "+(calView==="all"?C.accent:C.border),borderRadius:8,padding:"5px 14px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              All Staff
            </button>
            {employees.map(function(emp){
              var isSelected = calView===emp.id;
              return (
                <button key={emp.id} onClick={function(){setCalView(emp.id);}} style={{background:isSelected?"linear-gradient(135deg,"+C.accent+","+C.accentD+")":C.surface,color:isSelected?"#fff":C.ts,border:"1.5px solid "+(isSelected?C.accent:C.border),borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                  <Avatar name={emp.name} size={16} />
                  {emp.preferredName||emp.name.split(" ")[0]}
                </button>              );
            })}
          </div>

          {/* Calendar grid */}
          <Card noPad style={{overflow:"hidden"}}>
            {/* Calendar header */}
            <div style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <button onClick={prevMonth} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:6,color:"#fff",fontSize:14,cursor:"pointer",padding:"4px 10px",fontFamily:"inherit"}}>{"<"}</button>
              <span style={{color:"#fff",fontWeight:800,fontSize:16}}>{MONTHS_NAMES[month]} {year}</span>
              <button onClick={nextMonth} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:6,color:"#fff",fontSize:14,cursor:"pointer",padding:"4px 10px",fontFamily:"inherit"}}>{">"}</button>
            </div>
            {/* Day labels */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:C.surface,borderBottom:"1px solid "+C.border}}>
              {DAYS_SHORT.map(function(d){
                var isWknd = d==="Sat"||d==="Sun";
                return <div key={d} style={{textAlign:"center",padding:"8px 4px",color:isWknd?C.amber:C.ts,fontWeight:700,fontSize:11}}>{d}</div>;
              })}
            </div>
            {/* Calendar weeks */}
            <div style={{padding:8}}>
              {calGrid.map(function(week, wi) {
                return (
                  <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
                    {week.map(function(day, di) {
                      if (!day) return <div key={di} style={{minHeight:80}} />;
                      var today2 = new Date(); var isToday = day===today2.getDate()&&month===today2.getMonth()&&year===today2.getFullYear();
                      var isWknd = di===5||di===6;
                      // Determine what to show: all staff or single emp
                      var empToShow = calView && calView !== "all" ? employees.filter(function(e){return e.id===calView;}) : employees;
                      var shifts = empToShow.map(function(emp){
                        return {emp:emp, shiftId:getDateShift(emp.id, day)};
                      });
                      var workingCount = shifts.filter(function(s){return s.shiftId!=="off";}).length;
                      return (
                        <div key={di} style={{minHeight:80,border:"1.5px solid "+(isToday?C.accent:C.border+"66"),borderRadius:8,padding:"4px 5px",background:isToday?C.accentL:isWknd?"#FFFBEB":"#fff",overflow:"hidden"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                            <span style={{fontWeight:isToday?800:600,fontSize:12,color:isToday?C.accent:isWknd?C.amber:C.tp,background:isToday?C.accent+"22":"transparent",borderRadius:"50%",width:20,height:20,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{day}</span>
                            {calView==="all" && workingCount>0 && <span style={{fontSize:9,color:C.green,fontWeight:700}}>{workingCount} in</span>}
                          </div>
                          {shifts.map(function(s) {
                            var shift = getShiftById(s.shiftId, SP);
                            if (calView==="all" && s.shiftId==="off") return null;
                            return (
                              <div key={s.emp.id} title={s.emp.name+" - "+shift.name+(shift.start?" ("+shift.start+"-"+shift.end+")":"")}
                                style={{fontSize:9,fontWeight:700,color:shift.color,background:shift.color+"15",borderRadius:3,padding:"1px 4px",marginBottom:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                                {calView==="all" ? (s.emp.preferredName||s.emp.name.split(" ")[0]).substring(0,7) : shift.name}
                                {calView!=="all" && shift.start && <span style={{fontWeight:400,color:C.ts}}> {shift.start}</span>}
                              </div>                            );
                          })}
                        </div>                      );
                    })}
                  </div>                );
              })}
            </div>

            {/* Legend */}
            <div style={{padding:"10px 16px",background:C.surface,borderTop:"1px solid "+C.border,display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
              {SP.map(function(s){
                if (!s.start && s.id!=="off") return null;
                return (
                  <div key={s.id} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:12,height:12,borderRadius:2,background:s.color}} />
                    <span style={S.ts11}>{s.name}{s.start?" ("+s.start+"-"+s.end+")":""}</span>
                  </div>                );
              })}
            </div>
          </Card>

          {/* Monthly summary per emp */}
          {calView === "all" && (
            <div style={{marginTop:14}}>
              <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:10}}>{MONTHS_NAMES[month]} {year} - Working Day Summary</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
                {employees.map(function(emp) {
                  var workDays = countWorkingDays(emp.id);
                  var daysInMonth = new Date(year,month+1,0).getDate();
                  var empWh = wh[emp.id] || {start:"08:00",end:"17:00",brk:60};
                  var hrs = calcNetHours(empWh.start, empWh.end, empWh.brk);
                  var totalHrs = (hrs * workDays).toFixed(1);
                  return (
                    <div key={emp.id} style={{background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"10px 12px",borderTop:"3px solid "+C.accent}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
                        <Avatar name={emp.name} size={26} />
                        <div>
                          <div style={S.tp12b}>{emp.preferredName||emp.name.split(" ")[0]}</div>
                          <div style={S.ts9}>{emp.dept}</div>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                        {[["Working Days",workDays+"/"+daysInMonth,C.accent],["Total Hours",totalHrs+"h",C.green]].map(function(r){
                          return (
                            <div key={r[0]} style={{background:C.surface,borderRadius:5,padding:"5px 7px",textAlign:"center"}}>
                              <div style={{color:C.ts,fontSize:8,fontWeight:700}}>{r[0]}</div>
                              <div style={{color:r[2],fontWeight:800,fontSize:13,marginTop:1}}>{r[1]}</div>
                            </div>                          );
                        })}
                      </div>
                    </div>                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* -- TAB: SHIFT SETTINGS */}
      {tab === "shiftconfig" && (
        <div>
          {editShift && (
            <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
              <Card style={{width:500,padding:28}}>
                <div style={{color:C.tp,fontWeight:800,fontSize:16,marginBottom:4}}>Edit Shift</div>
                <div style={{color:C.ts,fontSize:12,marginBottom:18}}>Customise the name and working hours for this shift type.</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                  <div style={{gridColumn:"1 / -1"}}>
                    <label style={S.ts11b}>SHIFT NAME</label>
                    <input value={shiftForm.name||""} onChange={function(e){setShiftForm(function(f){return Object.assign({},f,{name:e.target.value});});}} placeholder="e.g. Morning, Afternoon, Night Shift..." style={Object.assign({},inputStyle,{fontWeight:700,fontSize:14})} />
                  </div>
                  <div>
                    <label style={S.ts11b}>START TIME</label>
                    <input type="time" value={shiftForm.start||""} onChange={function(e){setShiftForm(function(f){return Object.assign({},f,{start:e.target.value});});}} style={Object.assign({},inputStyle)} />
                  </div>
                  <div>
                    <label style={S.ts11b}>END TIME</label>
                    <input type="time" value={shiftForm.end||""} onChange={function(e){setShiftForm(function(f){return Object.assign({},f,{end:e.target.value});});}} style={Object.assign({},inputStyle)} />
                  </div>
                  <div>
                    <label style={S.ts11b}>BREAK (minutes)</label>
                    <input type="number" min="0" max="180" value={shiftForm.brk||0} onChange={function(e){setShiftForm(function(f){return Object.assign({},f,{brk:parseInt(e.target.value)||0});});}} style={Object.assign({},inputStyle)} />
                  </div>
                  <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",paddingBottom:4}}>
                    <div style={{color:C.green,fontWeight:800,fontSize:18}}>
                      {(shiftForm.start && shiftForm.end) ? calcNetHours(shiftForm.start, shiftForm.end, shiftForm.brk).toFixed(1)+" hrs" : "--"}
                    </div>
                    <div style={S.ts10}>net hours/day</div>
                  </div>
                  <div style={{gridColumn:"1 / -1"}}>
                    <label style={{color:C.ts,fontSize:11,fontWeight:700,display:"block",marginBottom:8}}>COLOUR</label>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {["#059669","#D97706","#7C3AED","#0EA5C9","#DC2626","#0369A1","#B45309","#1D4ED8","#047857","#6D28D9"].map(function(clr){
                        return (
                          <div key={clr} onClick={function(){setShiftForm(function(f){return Object.assign({},f,{color:clr});});}}
                            style={{width:28,height:28,borderRadius:"50%",background:clr,cursor:"pointer",border:shiftForm.color===clr?"3px solid "+C.tp:"3px solid transparent",boxShadow:shiftForm.color===clr?"0 0 0 2px #fff inset":""}} />                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <Btn c={C.ts} onClick={function(){setEditShift(null);}}>Cancel</Btn>
                  <Btn c={C.green} onClick={saveShiftEdit}>Save Shift</Btn>
                </div>
              </Card>
            </div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={S.tp14b}>Shift Configuration</div>
              <div style={{color:C.ts,fontSize:12,marginTop:2}}>Rename shifts and set working hours for Morning, Afternoon, Night, Flexible and Off Day types.</div>
            </div>
            <button onClick={resetShiftPresets} style={{background:C.surface,border:"1.5px solid "+C.border,borderRadius:8,color:C.ts,fontSize:11,fontWeight:600,padding:"6px 14px",cursor:"pointer",fontFamily:"inherit"}}>
              Reset to Defaults
            </button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
            {SP.map(function(shift) {
              var netH = shift.start ? calcNetHours(shift.start, shift.end, shift.brk) : 0;
              var isOff = !shift.start;
              return (
                <div key={shift.id} style={{background:C.card,border:"1.5px solid "+C.border,borderRadius:14,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
                  {/* Colour banner */}
                  <div style={{background:shift.color,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{color:"#fff",fontWeight:900,fontSize:17}}>{shift.name}</div>
                      <div style={{color:"rgba(255,255,255,.75)",fontSize:11,marginTop:2}}>
                        {isOff ? "Rest day" : shift.start+" - "+shift.end}
                      </div>
                    </div>
                    <div style={{background:"rgba(255,255,255,.2)",borderRadius:8,padding:"6px 14px",color:"#fff",fontWeight:800,fontSize:15}}>
                      {isOff ? "OFF" : netH.toFixed(1)+"h"}
                    </div>
                  </div>
                  {/* Details */}
                  <div style={{padding:"14px 18px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                      {[
                        ["Start", shift.start||"--"],
                        ["End",   shift.end||"--"],
                        ["Break", shift.brk+"min"],
                      ].map(function(row){
                        return (
                          <div key={row[0]} style={{background:C.surface,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                            <div style={{color:C.ts,fontSize:9,fontWeight:700,marginBottom:2}}>{row[0]}</div>
                            <div style={{color:shift.color,fontWeight:700,fontSize:13}}>{row[1]}</div>
                          </div>                        );
                      })}
                    </div>
                    {!isOff && (
                      <div style={{background:shift.color+"14",borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={S.ts11}>Net working hours per day</span>
                        <span style={{color:shift.color,fontWeight:800,fontSize:15}}>{netH.toFixed(1)} hrs</span>
                      </div>
                    )}
                    {!isOff && (
                      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                        <div style={{background:shift.color+"14",borderRadius:6,padding:"3px 10px",color:shift.color,fontSize:10,fontWeight:700}}>
                          ~{(netH*5).toFixed(0)}h/week (5-day)
                        </div>
                        <div style={{background:shift.color+"14",borderRadius:6,padding:"3px 10px",color:shift.color,fontSize:10,fontWeight:700}}>
                          RM/hr from payroll
                        </div>
                      </div>
                    )}
                    <button onClick={function(){openShiftEdit(shift);}} style={{width:"100%",background:"linear-gradient(135deg,"+shift.color+","+shift.color+"cc)",color:"#fff",border:"none",borderRadius:8,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      Edit Shift
                    </button>
                  </div>
                </div>              );
            })}
          </div>

          <div style={{marginTop:16,padding:"12px 16px",background:C.surface,borderRadius:10,color:C.ts,fontSize:11}}>
            Changes apply immediately to the roster, setup and calendar views. The Off Day shift cannot have working hours. All rate calculations in payroll use the hours set here.
          </div>
        </div>
      )}

    </div>  );
}

// -- A5 PAYSLIP PDF GENERATOR
function generatePayslipPDF(emp, payslip, companyName) {
  var A5_W = 559; var A5_H = 794;
  var primary = "#0EA5C9"; var dark = "#0F172A"; var gray = "#475569"; var light = "#EBF6FC";
  var epf = Math.round(payslip.basic * 0.11);
  var socso = parseFloat((Math.min(payslip.basic,6000)*0.005).toFixed(2));
  var eis = parseFloat((Math.min(payslip.basic,6000)*0.002).toFixed(2));
  var pcb = parseFloat((payslip.basic*0.05).toFixed(2));
  var totalDed = epf + socso + eis + pcb;
  var net = payslip.gross - totalDed;

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslip - '+emp.name+'</title>'
  +'<style>'
  +'@page{size:148mm 210mm;margin:0}'
  +'*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
  +'body{font-family:Arial,Helvetica,sans-serif;font-size:9px;color:'+dark+';background:#fff;width:148mm;min-height:210mm}'
  +'.page{width:148mm;min-height:210mm;padding:12mm 10mm}'
  +'.header{background:'+primary+';color:#fff;padding:10px 12px;border-radius:6px;margin-bottom:10px}'
  +'.co-name{font-size:13px;font-weight:900;letter-spacing:-0.3px}'
  +'.co-sub{font-size:8px;opacity:.8;margin-top:1px}'
  +'.title-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}'
  +'.payslip-title{font-size:14px;font-weight:900;color:'+dark+'}'
  +'.period-badge{background:'+light+';color:'+primary+';font-size:8px;font-weight:700;padding:4px 10px;border-radius:20px;border:1.5px solid '+primary+'44}'
  +'.emp-box{background:'+light+';border-radius:6px;padding:8px 10px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px}'
  +'.emp-row{display:flex;justify-content:space-between}'
  +'.emp-label{color:'+gray+';font-size:8px}'
  +'.emp-val{color:'+dark+';font-weight:700;font-size:8px;text-align:right}'
  +'.section{margin-bottom:8px}'
  +'.sec-title{font-size:9px;font-weight:900;color:'+primary+';text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid '+primary+';padding-bottom:3px;margin-bottom:6px}'
  +'.row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #EBF6FC;font-size:8.5px}'
  +'.row-label{color:'+gray+'}'
  +'.row-val{font-weight:600;color:'+dark+'}'
  +'.row-val.green{color:#059669}'
  +'.row-val.red{color:#DC2626}'
  +'.row-val.purple{color:#7C3AED}'
  +'.total-row{display:flex;justify-content:space-between;padding:5px 8px;border-radius:4px;margin-top:4px;font-size:9px;font-weight:700}'
  +'.net-box{background:'+primary+';color:#fff;border-radius:6px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;margin-top:8px}'
  +'.net-label{font-size:9px;opacity:.85}'
  +'.net-amount{font-size:17px;font-weight:900}'
  +'.footer{margin-top:10px;padding-top:8px;border-top:1px dashed #CBD5E1;display:flex;justify-content:space-between;font-size:7.5px;color:'+gray+'}'
  +'.sig-line{border-top:1px solid '+dark+';width:100px;text-align:center;padding-top:2px;font-size:7px;color:'+gray+';margin-top:20px}'
  +'</style></head><body><div class="page">'
  +'<div class="header"><div class="co-name">'+companyName+'</div><div class="co-sub">Official Payslip - Confidential</div></div>'
  +'<div class="title-row"><div class="payslip-title">PAYSLIP</div><div class="period-badge">'+payslip.period+'</div></div>'
  +'<div class="emp-box">'
  +'<div class="emp-row"><span class="emp-label">Employee Name</span><span class="emp-val">'+emp.name+'</span></div>'
  +'<div class="emp-row"><span class="emp-label">Employee ID</span><span class="emp-val">'+emp.id+'</span></div>'
  +'<div class="emp-row"><span class="emp-label">Department</span><span class="emp-val">'+emp.dept+'</span></div>'
  +'<div class="emp-row"><span class="emp-label">Position</span><span class="emp-val">'+(emp.position||emp.role||"--")+'</span></div>'
  +'<div class="emp-row"><span class="emp-label">IC / NRIC</span><span class="emp-val">'+(emp.nric||"--")+'</span></div>'
  +'<div class="emp-row"><span class="emp-label">Bank Account</span><span class="emp-val">'+emp.bankName+' ****'+(emp.bankAcc||"").slice(-4)+'</span></div>'
  +'</div>'
  +'<div class="section"><div class="sec-title">Earnings</div>'
  +'<div class="row"><span class="row-label">Basic Salary</span><span class="row-val green">RM '+(payslip.basic||0).toFixed(2)+'</span></div>'
  +(payslip.travel>0?'<div class="row"><span class="row-label">Travel Allowance</span><span class="row-val">RM '+payslip.travel.toFixed(2)+'</span></div>':'')
  +(payslip.other>0?'<div class="row"><span class="row-label">Other Allowance</span><span class="row-val">RM '+payslip.other.toFixed(2)+'</span></div>':'')
  +'<div class="total-row" style="background:#D1FAE5;color:#059669">Gross Earnings <span>RM '+(payslip.gross||0).toFixed(2)+'</span></div>'
  +'</div>'
  +'<div class="section"><div class="sec-title">Deductions</div>'
  +'<div class="row"><span class="row-label">EPF Employee (11%)</span><span class="row-val red">RM '+epf.toFixed(2)+'</span></div>'
  +'<div class="row"><span class="row-label">SOCSO Employee (~0.5%)</span><span class="row-val red">RM '+socso.toFixed(2)+'</span></div>'
  +'<div class="row"><span class="row-label">EIS Employee (0.2%)</span><span class="row-val red">RM '+eis.toFixed(2)+'</span></div>'
  +'<div class="row"><span class="row-label">PCB / MTD (Income Tax)</span><span class="row-val purple">RM '+pcb.toFixed(2)+'</span></div>'
  +'<div class="total-row" style="background:#FEE2E2;color:#DC2626">Total Deductions <span>RM '+totalDed.toFixed(2)+'</span></div>'
  +'</div>'
  +'<div class="net-box"><div><div class="net-label">Net Take-Home Pay</div><div style="font-size:7.5px;opacity:.7;margin-top:1px">'+emp.bankName+' ****'+(emp.bankAcc||"").slice(-4)+'</div></div><div class="net-amount">RM '+net.toFixed(2)+'</div></div>'
  +'<div class="footer">'
  +'<div>Generated: '+new Date().toLocaleDateString('en-MY')+'<br/>This is a computer-generated payslip.</div>'
  +'<div class="sig-line">Authorised Signature</div>'
  +'</div>'
  +'</div></body></html>';

  var blob = new Blob([html], {type:"text/html"});
  var url = URL.createObjectURL(blob);
  var win = window.open(url, "_blank");
  if (win) {
    win.onload = function() {
      setTimeout(function() { win.print(); }, 500);
    };
  }
}

// -- MY PORTAL MODULE (enhanced)
function MyPortal(props) {
  var emp          = props.viewAsEmployee;
  var allEmployees = props.employees || [];
  var companyName  = props.companyName || "TechCorp Sdn. Bhd.";
  var sched        = props.sched        || {};
  var wh           = props.wh           || {};
  var unifiedShift = props.unifiedShift || {Mon:"morning",Tue:"morning",Wed:"morning",Thu:"morning",Fri:"morning",Sat:"off",Sun:"off"};
  var schedMode    = props.schedMode    || "off";
  var shiftPresets = props.shiftPresets || INIT_SHIFT_PRESETS;
  // Shared global leaves — for manager approval
  var globalLeaves    = props.globalLeaves    || [];
  var setGlobalLeaves = props.setGlobalLeaves || function(){};
  // Subordinates of this employee
  var mySubordinates  = allEmployees.filter(function(e){ return e.managerId === emp.id; });
  var isManager       = mySubordinates.length > 0;
  // Pending leaves from subordinates only
  var myPendingLeaves = globalLeaves.filter(function(l){
    return l.status === "Pending" && mySubordinates.some(function(s){ return s.id === l.empId; });
  });

  var [ptab, setPtab] = useState("payslips");
  var [portalEA, setPortalEA] = useState(null);
  var [portalLang, setPortalLang] = useState("EN");
  var _pyr  = useState(2025);       var pyr  = _pyr[0];  var setPyr  = _pyr[1];
  var _pmo  = useState(5);          var pmo  = _pmo[0];  var setPmo  = _pmo[1];
  var _now   = useState(new Date()); var now = _now[0]; var setNow = _now[1];
  var _clocked = useState(false);    var clocked = _clocked[0]; var setClockedIn = _clocked[1];
  var _onBreak = useState(false);    var onBreak = _onBreak[0]; var setOnBreak = _onBreak[1];
  var _clockInTime  = useState(null); var clockInTime  = _clockInTime[0];  var setClockInTime  = _clockInTime[1];
  var [clockOutTime, setClockOutTime] = useState(null);
  var _breakStart   = useState(null); var breakStart   = _breakStart[0];   var setBreakStart   = _breakStart[1];
  var _totalBreak   = useState(0);    var totalBreak   = _totalBreak[0];   var setTotalBreak   = _totalBreak[1];
  var _attendLog    = useState([
    {date:"2025-06-04",day:"Wed",clockIn:"08:02",clockOut:"17:05",breakMin:62,status:"Present",note:""},
    {date:"2025-06-03",day:"Tue",clockIn:"08:15",clockOut:"17:00",breakMin:60,status:"Late",   note:"Late 15 min"},
    {date:"2025-06-02",day:"Mon",clockIn:"07:58",clockOut:"17:03",breakMin:60,status:"Present",note:""},
    {date:"2025-05-30",day:"Fri",clockIn:"08:00",clockOut:"17:00",breakMin:60,status:"Present",note:""},
    {date:"2025-05-29",day:"Thu",clockIn:"08:10",clockOut:"17:00",breakMin:58,status:"Present",note:""},
    {date:"2025-05-28",day:"Wed",clockIn:"",     clockOut:"",     breakMin:0, status:"Absent", note:"MC submitted"},
    {date:"2025-05-27",day:"Tue",clockIn:"08:01",clockOut:"17:02",breakMin:61,status:"Present",note:""},
  ]);
  var attendLog = _attendLog[0]; var setAttendLog = _attendLog[1];
  useState(function() {
    var timer = setInterval(function() { setNow(new Date()); }, 1000);
    return function() { clearInterval(timer); };
  });

  // ── Manager approval state ──────────────────────────────────────────────
  var [approvalNote,   setApprovalNote]   = useState({});   // {leaveId: "reason text"}
  var [approvalToast,  setApprovalToast]  = useState(null); // {msg, color}
  var [reminderLog,    setReminderLog]    = useState([]);   // log of sent reminders
  var [reminderActive, setReminderActive] = useState(true);

  // Daily reminder — fires every 24h (simulated as 30s in demo) when there are pending subordinate leaves
  useState(function() {
    if (!isManager) return;
    var sendReminder = function() {
      var pending = globalLeaves.filter(function(l){
        return l.status === "Pending" && mySubordinates.some(function(s){ return s.id === l.empId; });
      });
      if (pending.length === 0) return;
      var now2 = new Date();
      var timeStr = now2.toLocaleTimeString("en-MY",{hour:"2-digit",minute:"2-digit"});
      var entry = {
        id: Date.now(),
        time: timeStr,
        date: now2.toISOString().slice(0,10),
        count: pending.length,
        names: pending.map(function(l){ return l.name; }).join(", "),
      };
      setReminderLog(function(prev){ return [entry].concat(prev).slice(0,20); });
      setApprovalToast({msg:"📧 Daily reminder sent: "+pending.length+" leave"+(pending.length>1?"s":"")+" pending your approval", color:C.accent});
      setTimeout(function(){ setApprovalToast(null); }, 5000);
    };
    // Fire immediately on mount if pending
    var t1 = setTimeout(sendReminder, 1500);
    // Then every 30s in demo (represents daily in production)
    var t2 = setInterval(sendReminder, 30000);
    return function(){ clearTimeout(t1); clearInterval(t2); };
  });

  var approveLeave = function(id) {
    setGlobalLeaves(function(prev){ return prev.map(function(l){ return l.id===id ? Object.assign({},l,{status:"Approved",approvedBy:emp.name,approvedOn:new Date().toISOString().slice(0,10)}) : l; }); });
    setApprovalToast({msg:"✅ Leave approved successfully", color:C.green});
    setTimeout(function(){ setApprovalToast(null); }, 3000);
  };
  var rejectLeave = function(id, reason) {
    setGlobalLeaves(function(prev){ return prev.map(function(l){ return l.id===id ? Object.assign({},l,{status:"Rejected",rejectedBy:emp.name,rejectedOn:new Date().toISOString().slice(0,10),rejectReason:reason||""}) : l; }); });
    setApprovalToast({msg:"❌ Leave rejected", color:C.red});
    setTimeout(function(){ setApprovalToast(null); }, 3000);
  };
  var pad2 = function(n) { return String(n).padStart(2,"0"); };
  var fmtTime = function(d) { if (!d) return "--:--"; return pad2(d.getHours())+":"+pad2(d.getMinutes())+":"+pad2(d.getSeconds()); };
  var fmtTimeShort = function(d) { if (!d) return "--:--"; return pad2(d.getHours())+":"+pad2(d.getMinutes()); };
  var minsElapsed = function(from, to) { return from ? Math.floor((to - from) / 60000) : 0; };

  var handleClockIn = function() {
    var t = new Date();
    setClockedIn(true);
    setClockInTime(t);
    setClockOutTime(null);
    setBreakStart(null);
    setTotalBreak(0);
    setOnBreak(false);
  };

  var handleClockOut = function() {
    var t = new Date();
    setClockedIn(false);
    setClockOutTime(t);
    if (onBreak && breakStart) {
      setTotalBreak(function(prev) { return prev + minsElapsed(breakStart, t); });
    }
    setOnBreak(false);
    setBreakStart(null);
    var empWh2 = wh[emp.id] || {start:"08:00"};
    var sp = empWh2.start.split(":");
    var schedStart = parseInt(sp[0])*60 + parseInt(sp[1]);
    var actualStart = clockInTime ? clockInTime.getHours()*60 + clockInTime.getMinutes() : schedStart;
    var lateMin = actualStart - schedStart;
    var brk = onBreak && breakStart ? totalBreak + minsElapsed(breakStart,t) : totalBreak;
    var netMin = clockInTime ? minsElapsed(clockInTime, t) - brk : 0;
    var today2 = new Date();
    var dNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    var newEntry = {
      date: today2.getFullYear()+"-"+pad2(today2.getMonth()+1)+"-"+pad2(today2.getDate()),
      day:  dNames[today2.getDay()],
      clockIn:  fmtTimeShort(clockInTime),
      clockOut: fmtTimeShort(t),
      breakMin: brk,
      netMin:   netMin,
      status:   lateMin > 5 ? "Late" : "Present",
      note:     lateMin > 5 ? ("Late "+lateMin+" min") : "",
    };
    setAttendLog(function(prev) { return [newEntry].concat(prev); });
  };

  var handleBreakStart = function() {
    setOnBreak(true);
    setBreakStart(new Date());
  };

  var handleBreakEnd = function() {
    var t = new Date();
    setTotalBreak(function(prev) { return prev + minsElapsed(breakStart, t); });
    setOnBreak(false);
    setBreakStart(null);
  };
  var liveWorkMin = clocked && clockInTime ? minsElapsed(clockInTime, now) - (totalBreak + (onBreak && breakStart ? minsElapsed(breakStart, now) : 0)) : 0;
  var liveBreakMin = onBreak && breakStart ? minsElapsed(breakStart, now) : 0;
  var fmtElapsed = function(mins) {
    var h = Math.floor(mins/60); var m = mins % 60;
    return pad2(h)+"h "+pad2(m)+"m";
  };

  if (!emp) return <Card><div style={{color:C.ts,textAlign:"center",padding:40}}>No employee selected</div></Card>;

  var payslips = [
    {period:"June 2025",  month:"2025-06", basic:emp.basic, gross:emp.basic+(emp.travelAllow||0)+(emp.otherAllow||0), travel:emp.travelAllow||0, other:emp.otherAllow||0, status:"Published"},
    {period:"May 2025",   month:"2025-05", basic:emp.basic, gross:emp.basic+(emp.travelAllow||0)+(emp.otherAllow||0), travel:emp.travelAllow||0, other:emp.otherAllow||0, status:"Published"},
    {period:"April 2025", month:"2025-04", basic:emp.basic, gross:emp.basic+(emp.travelAllow||0)+(emp.otherAllow||0), travel:emp.travelAllow||0, other:emp.otherAllow||0, status:"Published"},
  ];

  var epf = Math.round(emp.basic*0.11);
  var totalDed = epf + parseFloat((Math.min(emp.basic,6000)*0.005).toFixed(2)) + parseFloat((Math.min(emp.basic,6000)*0.002).toFixed(2)) + parseFloat((emp.basic*0.05).toFixed(2));

  // -- Schedule helpers
  var getShift = function(day) {
    var empSched = sched[emp.id] || {};
    var dateStr = pyr+"-"+String(pmo+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
    var jsDay = new Date(pyr, pmo, day).getDay();
    var dayIdx = [6,0,1,2,3,4,5][jsDay];
    var dayKey = DAYS_SHORT[dayIdx];
    if (empSched[dateStr] !== undefined) return empSched[dateStr];
    if (schedMode === "on") return (dayKey==="Sat"||dayKey==="Sun") ? "off" : "morning";
    return unifiedShift[dayKey] || "off";
  };

  var getShiftObj = function(shiftId) {
    return getShiftById(shiftId, shiftPresets);
  };

  var empWh = wh[emp.id] || {start:"08:00",end:"17:00",brk:60,flexible:false,ot:false};
  var netHrs = calcNetHours(empWh.start, empWh.end, empWh.brk);

  var calGrid = buildCalendar(pyr, pmo);
  var daysInMonth = new Date(pyr, pmo+1, 0).getDate();
  var workDays = 0;
  for (var d2 = 1; d2 <= daysInMonth; d2++) { if (getShift(d2) !== "off") workDays++; }
  var totalHrs = (netHrs * workDays).toFixed(1);

  var prevMonth2 = function() {
    if (pmo===0){setPmo(11);setPyr(function(y){return y-1;});}
    else setPmo(function(m){return m-1;});
  };
  var nextMonth2 = function() {
    if (pmo===11){setPmo(0);setPyr(function(y){return y+1;});}
    else setPmo(function(m){return m+1;});
  };

  var PORTAL_TABS = [
    ["payslips","My Payslips",<DollarSign size={14}/>],
    ["timeclock","Time Clock",<Clock size={14}/>],
    ["schedule","My Schedule",<Calendar size={14}/>],
    ["leave","Leave & Apply",<Umbrella size={14}/>],
    ["documents","My Documents",<FileText size={14}/>],
  ].concat(isManager ? [["approvals","Team Approvals",<CheckSquare size={14}/>]] : []);
  var _lvApps = useState([
    {id:"LA001",type:"Annual Leave",typeColor:"#0EA5C9",from:"2025-05-12",to:"2025-05-14",days:3,reason:"Family trip to Penang",doc:null,docName:"",status:"Approved",submittedOn:"2025-05-01"},
    {id:"LA002",type:"Sick Leave",  typeColor:"#059669",from:"2025-04-03",to:"2025-04-03",days:1,reason:"Fever and sore throat",doc:null,docName:"MC_Apr03.pdf",status:"Approved",submittedOn:"2025-04-03"},
    {id:"LA003",type:"Annual Leave",typeColor:"#0EA5C9",from:"2025-02-10",to:"2025-02-12",days:3,reason:"CNY holiday",doc:null,docName:"",status:"Approved",submittedOn:"2025-02-05"},
  ]);
  var lvApps = _lvApps[0]; var setLvApps = _lvApps[1];

  var _lvView  = useState("list");  var lvView  = _lvView[0];  var setLvView  = _lvView[1];
  var _lvForm  = useState({type:"Annual Leave",from:"",to:"",reason:"",docName:"",docData:null,halfDay:false,halfDaySlot:"AM"});
  var lvForm   = _lvForm[0]; var setLvForm = _lvForm[1];
  var _lvErr   = useState({}); var lvErr = _lvErr[0]; var setLvErr = _lvErr[1];
  var [lvSubmitting, setLvSubmitting] = useState(false);
  var [lvSuccess, setLvSuccess] = useState(false);
  var [lvDetail, setLvDetail] = useState(null);

  var lvTypeColors = {"Annual Leave":"#0EA5C9","Sick Leave":"#059669","Emergency Leave":"#DC2626","Maternity Leave":"#EC4899","Paternity Leave":"#3B82F6","Hospitalisation Leave":"#7C3AED","Unpaid Leave":"#94A3B8","Replacement Leave":"#D97706"};
  var leaveConfig2 = props.leaveConfig || {leaveTypes:[]};
  var leaveTypes2  = leaveConfig2.leaveTypes && leaveConfig2.leaveTypes.length
    ? leaveConfig2.leaveTypes.filter(function(t){return t.id!=="UL";})
    : Object.keys(lvTypeColors).map(function(k){return {name:k,color:lvTypeColors[k],requireDoc:k==="Sick Leave"||k==="Hospitalisation Leave"};});

  var getLvColor = function(typeName) {
    var lt = leaveTypes2.find(function(t){return t.name===typeName;});
    return lt ? lt.color : (lvTypeColors[typeName] || C.accent);
  };

  var calcDays = function(from, to) {
    if (!from || !to) return 0;
    var a = new Date(from+"T00:00:00"); var b = new Date(to+"T00:00:00");
    if (b < a) return 0;
    return Math.floor((b - a) / 86400000) + 1;
  };

  var setLF = function(k, v) { setLvForm(function(f){ var u=Object.assign({},f); u[k]=v; return u; }); setLvErr({}); };

  var handleDocUpload = function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      setLvForm(function(f){ return Object.assign({},f,{docName:file.name,docData:ev.target.result,docType:file.type}); });
    };
    reader.readAsDataURL(file);
  };

  var validateLvForm = function() {
    var errs = {};
    if (!lvForm.type)   errs.type   = "Select a leave type";
    if (!lvForm.from)   errs.from   = "Select start date";
    if (!lvForm.to)     errs.to     = "Select end date";
    if (lvForm.from && lvForm.to && lvForm.to < lvForm.from) errs.to = "End date must be after start date";
    if (!lvForm.reason || !lvForm.reason.trim()) errs.reason = "Please provide a reason";
    var lt = leaveTypes2.find(function(t){return t.name===lvForm.type;});
    if (lt && lt.requireDoc && !lvForm.docName) errs.doc = "This leave type requires supporting document (MC / certificate)";
    setLvErr(errs);
    return Object.keys(errs).length === 0;
  };

  var submitLeave = function() {
    if (!validateLvForm()) return;
    setLvSubmitting(true);
    setTimeout(function() {
      var days = lvForm.halfDay ? 0.5 : calcDays(lvForm.from, lvForm.to);
      var newApp = {
        id: "LA"+Date.now().toString().slice(-5),
        type: lvForm.type,
        typeColor: getLvColor(lvForm.type),
        from: lvForm.from,
        to:   lvForm.to,
        days: days,
        reason: lvForm.reason,
        docName: lvForm.docName || "",
        docData: lvForm.docData || null,
        docType: lvForm.docType || "",
        halfDay: lvForm.halfDay,
        halfDaySlot: lvForm.halfDaySlot,
        status: "Pending",
        submittedOn: new Date().toISOString().slice(0,10),
      };
      setLvApps(function(prev){ return [newApp].concat(prev); });
      setLvForm({type:"Annual Leave",from:"",to:"",reason:"",docName:"",docData:null,halfDay:false,halfDaySlot:"AM"});
      setLvSubmitting(false);
      setLvSuccess(true);
      setTimeout(function(){ setLvSuccess(false); setLvView("list"); }, 2000);
    }, 800);
  };

  var cancelApp = function(id) {
    setLvApps(function(prev){ return prev.map(function(a){ return a.id===id && a.status==="Pending" ? Object.assign({},a,{status:"Cancelled"}) : a; }); });
  };

  // Leave balance summary (static + deduct from approved apps)
  var lvBalances = [
    {name:"Annual Leave",   total:12, color:"#0EA5C9"},
    {name:"Sick Leave",     total:14, color:"#059669"},
    {name:"Emergency Leave",total:3,  color:"#DC2626"},
    {name:"Replacement Leave", total:2, color:"#D97706"},
  ];
  var getUsed = function(typeName) {
    return lvApps.filter(function(a){ return a.type===typeName && a.status==="Approved"; }).reduce(function(s,a){ return s+a.days; }, 0);
  };

  return (
    <div>
      <SectionHead title="My Portal" sub={"Self-service - "+emp.name} />

      {/* Borang EA preview modal */}
      {portalEA && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(10,18,40,.85)",zIndex:3000,display:"flex",flexDirection:"column"}}>
          <div style={{background:"#0F172A",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,.1)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{color:"#fff",fontWeight:700,fontSize:14}}>📋 Borang EA {portalEA.yr} — {emp.name}</span>
              <div style={{display:"flex",borderRadius:7,overflow:"hidden",border:"1px solid rgba(255,255,255,.25)",marginLeft:8}}>
                {[["EN","🇬🇧 English"],["BM","🇲🇾 BM"]].map(function(opt){
                  return (
                    <button key={opt[0]} onClick={function(){setPortalLang(opt[0]);}} style={{padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"none",background:portalLang===opt[0]?"#4F6EF7":"transparent",color:"#fff",transition:"background .15s"}}>
                      {opt[1]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button onClick={function(){generateEaPDF(portalEA,portalLang,{name:companyName});}} style={{background:"linear-gradient(135deg,#059669,#047857)",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                ⬇ Download {portalLang==="BM"?"(BM)":"(English)"}
              </button>
              <button onClick={function(){setPortalEA(null);}} style={{background:"rgba(255,255,255,.12)",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"24px",display:"flex",justifyContent:"center",background:"#1E293B"}}>
            <div style={{width:"100%",maxWidth:780,background:"#fff",borderRadius:6,boxShadow:"0 8px 40px rgba(0,0,0,.5)",overflow:"hidden"}}>
              <EAPreview data={portalEA} lang={portalLang} co={{name:companyName}} />
            </div>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16}}>

        {/* -- Left sidebar: profile */}
        <div>
          <Card style={S.mb12}>
            <div style={{textAlign:"center",paddingBottom:14,borderBottom:"1px solid "+C.border,marginBottom:12}}>
              <Avatar name={emp.name} size={56} />
              <div style={{color:C.tp,fontWeight:800,fontSize:14,marginTop:10}}>{emp.name}</div>
              <div style={{color:C.ts,fontSize:11,marginTop:3}}>{emp.position||emp.role}</div>
              <div style={{color:C.ts,fontSize:10,marginTop:1}}>{emp.dept} - {emp.id}</div>
              <div style={{marginTop:8}}><StatusChip s={emp.status} /></div>
            </div>
            {[["Joined",emp.joinDate],["Email",emp.workEmail],["Phone",emp.phone],["Bank",emp.bankName]].map(function(item){
              return (
                <div key={item[0]} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+C.border+"44"}}>
                  <span style={S.ts11}>{item[0]}</span>
                  <span style={{color:C.tp,fontSize:11,fontWeight:600}}>{item[1]||"--"}</span>
                </div>              );
            })}
            <div style={{marginTop:12,background:C.greenL,borderRadius:8,padding:"10px 12px"}}>
              <div style={{color:C.ts,fontSize:9,fontWeight:700,marginBottom:6}}>THIS MONTH SALARY</div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{color:C.green,fontWeight:800,fontSize:14}}>RM {emp.basic.toFixed(0)}</div>
                  <div style={S.ts9}>Basic</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{color:"#DC2626",fontWeight:800,fontSize:14}}>RM {totalDed.toFixed(0)}</div>
                  <div style={S.ts9}>Deductions</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{color:C.accent,fontWeight:800,fontSize:14}}>RM {(emp.basic+(emp.travelAllow||0)+(emp.otherAllow||0)-totalDed).toFixed(0)}</div>
                  <div style={S.ts9}>Net Pay</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Work Hours card */}
          <Card style={{borderLeft:"4px solid "+(empWh.flexible?C.accent:C.green)}}>
            <div style={{color:C.tp,fontWeight:700,fontSize:12,marginBottom:10}}>My Working Hours</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
              {[["Start",empWh.start,C.green],["End",empWh.end,"#DC2626"],["Break",empWh.brk+"min",C.amber],["Net",netHrs.toFixed(1)+"h/day",C.accent]].map(function(r){
                return (
                  <div key={r[0]} style={{background:C.surface,borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
                    <div style={S.ts9b}>{r[0]}</div>
                    <div style={{color:r[2],fontWeight:700,fontSize:12,marginTop:1}}>{r[1]||"--"}</div>
                  </div>                );
              })}
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {empWh.flexible && <span style={{background:C.accentL,color:C.accent,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8}}>Flexible</span>}
              {empWh.ot && <span style={{background:C.greenL,color:C.green,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8}}>OT Eligible</span>}
              {!empWh.ot && <span style={{background:C.surface,color:C.ts,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8}}>No OT</span>}
            </div>
          </Card>
        </div>

        {/* -- Right content: tabs */}
        <div>
          {/* Approval toast */}
          {approvalToast && (
            <div style={{position:"fixed",top:20,right:24,zIndex:9999,background:approvalToast.color,color:"#fff",padding:"12px 20px",borderRadius:10,fontWeight:700,fontSize:13,boxShadow:"0 4px 20px rgba(0,0,0,.25)",animation:"fadeIn .2s ease"}}>
              {approvalToast.msg}
            </div>
          )}

          {/* Tab bar */}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {PORTAL_TABS.map(function(t){
              var active = ptab===t[0];
              var badge  = t[0]==="approvals" && myPendingLeaves.length > 0;
              return (
                <button key={t[0]} onClick={function(){setPtab(t[0]);}} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:10,border:"1.5px solid "+(active?C.accent+"66":(badge?C.amber+"88":C.border)),background:active?"linear-gradient(135deg,"+C.accent+","+C.accentD+")":(badge?"#FFFBEB":"transparent"),color:active?"#fff":(badge?C.amber:C.ts),fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",position:"relative"}}>
                  <span>{t[2]}</span> {t[1]}
                  {badge && <span style={{background:C.red,color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",marginLeft:2}}>{myPendingLeaves.length}</span>}
                </button>              );
            })}
          </div>

          {/* -- PAYSLIPS TAB */}
          {ptab === "payslips" && (
            <div>
              {payslips.map(function(p,i){
                var net = p.gross-(Math.round(p.basic*0.11)+parseFloat((Math.min(p.basic,6000)*0.005).toFixed(2))+parseFloat((Math.min(p.basic,6000)*0.002).toFixed(2))+parseFloat((p.basic*0.05).toFixed(2)));
                return (
                  <Card key={i} style={{marginBottom:10,padding:"14px 18px"}}>
                    <div style={S.rowJSB}>
                      <div>
                        <div style={S.tp14b}>{p.period}</div>
                        <div style={{color:C.ts,fontSize:12,marginTop:2}}>
                          Gross: <span style={{color:C.green,fontWeight:600}}>RM {p.gross.toFixed(2)}</span>
                          {" "}&nbsp;|&nbsp;{" "}
                          Net: <span style={{color:C.accent,fontWeight:700}}>RM {net.toFixed(2)}</span>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <StatusChip s={p.status} />
                        <button onClick={function(){generatePayslipPDF(emp,p,companyName);}} style={{background:"linear-gradient(135deg,#DC2626,#b91c1c)",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:13}}>📄</span> PDF
                        </button>
                      </div>
                    </div>
                    <div style={{marginTop:10,background:C.surface,borderRadius:6,padding:"8px 10px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                      {[["EPF EE","RM "+Math.round(p.basic*0.11),C.green],["SOCSO","RM "+(Math.min(p.basic,6000)*0.005).toFixed(2),C.accent],["EIS","RM "+(Math.min(p.basic,6000)*0.002).toFixed(2),C.accent],["PCB","RM "+(p.basic*0.05).toFixed(2),C.purple]].map(function(item){
                        return (
                          <div key={item[0]} style={{textAlign:"center"}}>
                            <div style={S.ts9b}>{item[0]}</div>
                            <div style={{color:item[2],fontWeight:700,fontSize:11,marginTop:1}}>{item[1]}</div>
                          </div>                        );
                      })}
                    </div>
                  </Card>                );
              })}
              {/* EA / Tax Documents Section */}
              <Card style={{marginTop:14,borderTop:"3px solid #1E40AF"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={S.tp14b}>Tax Documents (Borang EA)</div>
                    <div style={{color:C.ts,fontSize:11,marginTop:2}}>Your annual income statement. Required for personal income tax filing with LHDN.</div>
                  </div>
                  <span style={{background:"#EFF6FF",color:"#1E40AF",fontWeight:700,fontSize:10,padding:"3px 10px",borderRadius:6}}>EA / CP8A</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[2025,2024,2023].map(function(eaYr){
                    var eaData = buildEA(emp, eaYr);
                    return (
                        <div key={eaYr} style={{background:C.surface,borderRadius:10,border:"1px solid "+C.border,overflow:"hidden"}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px"}}>
                          <div style={{width:36,height:36,borderRadius:8,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📋</div>
                          <div style={{flex:1}}>
                            <div style={S.tp13b}>Borang EA {eaYr}</div>
                            <div style={{color:C.ts,fontSize:11,marginTop:1}}>
                              Gross: <span style={{color:C.green,fontWeight:600}}>RM {(eaData.grand||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                              &nbsp;·&nbsp; PCB: <span style={{color:"#7C3AED",fontWeight:600}}>RM {(eaData.d1||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                              &nbsp;·&nbsp; EPF: <span style={{color:C.accent,fontWeight:600}}>RM {(eaData.e1_amt||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:6,flexShrink:0}}>
                            <button onClick={function(){setPortalEA(eaData); setPortalLang("EN");}} style={{background:"linear-gradient(135deg,#1E40AF,#1D4ED8)",color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                              👁 Preview &amp; Download
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:10,padding:"8px 12px",background:C.amberL,borderRadius:7,borderLeft:"3px solid "+C.amber,display:"flex",gap:8,alignItems:"flex-start"}}>
                  <span style={{fontSize:14}}>💡</span>
                  <div style={{color:C.amber,fontSize:10,lineHeight:1.5}}>Borang EA must be submitted with your personal income tax return (Borang BE) to LHDN by 30 April each year. Keep all EA forms for at least 7 years.</div>
                </div>
              </Card>
            </div>
          )}

          {/* -- TIME CLOCK TAB */}
          {ptab === "timeclock" && (
            <div>
              {/* -- Big clock display */}
              <Card style={{marginBottom:14,padding:0,overflow:"hidden"}}>
                <div style={{background:"linear-gradient(135deg,#0F172A,#1E293B)",padding:"28px 24px",textAlign:"center"}}>
                  <div style={{color:"#64748B",fontSize:11,fontWeight:700,letterSpacing:2,marginBottom:6}}>CURRENT TIME</div>
                  <div style={{color:"#F8FAFC",fontWeight:900,fontSize:52,fontFamily:"monospace,sans-serif",letterSpacing:4,lineHeight:1}}>
                    {fmtTime(now)}
                  </div>
                  <div style={{color:"#94A3B8",fontSize:13,marginTop:8}}>
                    {now.toLocaleDateString("en-MY",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                  </div>
                  {clocked && (
                    <div style={{marginTop:16,display:"flex",justifyContent:"center",gap:24}}>
                      <div style={{textAlign:"center"}}>
                        <div style={{color:"#4ADE80",fontWeight:900,fontSize:24,fontFamily:"monospace"}}>{fmtElapsed(liveWorkMin)}</div>
                        <div style={{color:"#94A3B8",fontSize:10,marginTop:2}}>Work Time</div>
                      </div>
                      {onBreak && (
                        <div style={{textAlign:"center"}}>
                          <div style={{color:"#FCD34D",fontWeight:900,fontSize:24,fontFamily:"monospace"}}>{fmtElapsed(liveBreakMin)}</div>
                          <div style={{color:"#94A3B8",fontSize:10,marginTop:2}}>Break Time</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status bar */}
                <div style={{padding:"12px 20px",background:clocked?(onBreak?"#92400E22":"#14532D22"):"#1E293B22",borderTop:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div style={S.rowG10}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:clocked?(onBreak?C.amber:C.green):"#94A3B8",boxShadow:clocked?"0 0 8px "+(onBreak?C.amber:C.green):"none"}} />
                    <span style={S.tp13b}>{clocked ? (onBreak ? "On Break" : "Clocked In") : "Not Clocked In"}</span>
                    {clocked && clockInTime && (
                      <span style={S.ts12}>since {fmtTimeShort(clockInTime)}</span>
                    )}
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {!clocked && (
                      <button onClick={handleClockIn} style={{background:"linear-gradient(135deg,#059669,#047857)",color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",letterSpacing:.5}}>
                        Clock In
                      </button>
                    )}
                    {clocked && !onBreak && (
                      <button onClick={handleBreakStart} style={{background:"linear-gradient(135deg,"+C.amber+",#B45309)",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        Start Break
                      </button>
                    )}
                    {clocked && onBreak && (
                      <button onClick={handleBreakEnd} style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        End Break
                      </button>
                    )}
                    {clocked && (
                      <button onClick={handleClockOut} style={{background:"linear-gradient(135deg,#DC2626,#b91c1c)",color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",letterSpacing:.5}}>
                        Clock Out
                      </button>
                    )}
                  </div>
                </div>
              </Card>

              {/* -- Today summary */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                {[
                  ["Clock In",  clocked||clockInTime  ? fmtTimeShort(clockInTime)  : "--:--", C.green,  "Scheduled: "+(wh[emp.id]||{start:"08:00"}).start],
                  ["Clock Out", clockOutTime           ? fmtTimeShort(clockOutTime) : "--:--", "#DC2626", "Scheduled: "+(wh[emp.id]||{end:"17:00"}).end],
                  ["Break",     (totalBreak+(onBreak&&breakStart?liveBreakMin:0))+"m", C.amber, "Allowed: "+((wh[emp.id]||{brk:60}).brk)+"m"],
                  ["Work Time", clocked ? fmtElapsed(liveWorkMin) : (clockOutTime&&clockInTime ? fmtElapsed(minsElapsed(clockInTime,clockOutTime)-totalBreak) : "--"), C.accent, "Target: "+calcNetHours((wh[emp.id]||{start:"08:00"}).start,(wh[emp.id]||{end:"17:00"}).end,(wh[emp.id]||{brk:60}).brk).toFixed(1)+"h"],
                ].map(function(item){
                  return (
                    <Card key={item[0]} style={{textAlign:"center",padding:"12px 10px",borderTop:"3px solid "+item[2]}}>
                      <div style={{color:item[2],fontWeight:900,fontSize:18,fontFamily:"monospace"}}>{item[1]}</div>
                      <div style={{color:C.tp,fontSize:10,fontWeight:700,marginTop:3}}>{item[0]}</div>
                      <div style={{color:C.ts,fontSize:9,marginTop:2}}>{item[3]}</div>
                    </Card>                  );
                })}
              </div>

              {/* -- Shift info for today */}
              {(function(){
                var today3 = new Date();
                var shiftId3 = getShift(today3.getDate());
                var shift3 = getShiftObj(shiftId3);
                var empWh3 = wh[emp.id] || {start:"08:00",end:"17:00",brk:60};
                var spArr = empWh3.start.split(":");
                var schedStartMin = parseInt(spArr[0])*60+parseInt(spArr[1]);
                var nowMin = now.getHours()*60+now.getMinutes();
                var lateMin2 = clocked && clockInTime ? Math.max(0,(clockInTime.getHours()*60+clockInTime.getMinutes())-schedStartMin) : 0;
                return (
                  <Card style={{marginBottom:14,padding:"12px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                      <div style={S.rowG10}>
                        <div style={{width:12,height:12,borderRadius:3,background:shift3.color,flexShrink:0}} />
                        <div>
                          <span style={S.tp13b}>Today: {shift3.name}</span>
                          {shift3.start && <span style={{color:C.ts,fontSize:12,marginLeft:8}}>{shift3.start} - {shift3.end}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        {lateMin2 > 0 && (
                          <span style={{background:"#FEF2F2",color:"#DC2626",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:8}}>Late {lateMin2} min</span>
                        )}
                        {clocked && lateMin2 === 0 && (
                          <span style={{background:C.greenL,color:C.green,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:8}}>On Time</span>
                        )}
                        {shiftId3 === "off" && (
                          <span style={{background:C.surface,color:C.ts,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:8}}>Rest Day</span>
                        )}
                      </div>
                    </div>
                  </Card>                );
              })()}

              {/* -- Attendance log */}
              <Card noPad style={{overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:C.surface,borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={S.tp13b}>Attendance History</span>
                  <div style={S.rowG6}>
                    {[["Present",C.green],["Late",C.amber],["Absent","#DC2626"]].map(function(s){
                      var count = attendLog.filter(function(r){return r.status===s[0];}).length;
                      return <span key={s[0]} style={{background:s[1]+"18",color:s[1],fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8}}>{s[0]}: {count}</span>;
                    })}
                  </div>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:C.surface}}>
                        {["Date","Day","Clock In","Clock Out","Break","Work Time","Status","Note"].map(function(h){
                          return <th key={h} style={{padding:"8px 12px",textAlign:"left",color:C.ts,fontWeight:700,borderBottom:"1px solid "+C.border,whiteSpace:"nowrap"}}>{h}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {attendLog.map(function(row,i){
                        var statusColor = row.status==="Present"?C.green:row.status==="Late"?C.amber:"#DC2626";
                        var netM = row.netMin !== undefined ? row.netMin : (row.clockIn && row.clockOut ? (function(){
                          var sp2=row.clockIn.split(":"); var ep2=row.clockOut.split(":");
                          var sm2=parseInt(sp2[0])*60+parseInt(sp2[1]);
                          var em3=parseInt(ep2[0])*60+parseInt(ep2[1]);
                          if(em3<sm2) em3+=24*60;
                          return em3-sm2-(row.breakMin||0);
                        })() : 0);
                        var h2=Math.floor(netM/60); var m2=netM%60;
                        return (
                          <tr key={i} style={{borderBottom:"1px solid "+C.border+"44",background:i%2===0?"transparent":"#F8FAFC"}}>
                            <td style={{padding:"9px 12px",color:C.tp,fontWeight:600}}>{row.date}</td>
                            <td style={{padding:"9px 12px",color:C.ts}}>{row.day}</td>
                            <td style={{padding:"9px 12px",color:C.green,fontWeight:700,fontFamily:"monospace"}}>{row.clockIn||"--"}</td>
                            <td style={{padding:"9px 12px",color:"#DC2626",fontWeight:700,fontFamily:"monospace"}}>{row.clockOut||"--"}</td>
                            <td style={{padding:"9px 12px",color:C.amber}}>{row.breakMin ? row.breakMin+"m" : "--"}</td>
                            <td style={{padding:"9px 12px",color:C.accent,fontWeight:700,fontFamily:"monospace"}}>{row.clockIn&&row.clockOut ? h2+"h "+pad2(m2)+"m" : "--"}</td>
                            <td style={{padding:"9px 12px"}}>
                              <span style={{background:statusColor+"18",color:statusColor,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6}}>{row.status}</span>
                            </td>
                            <td style={{padding:"9px 12px",color:C.ts,fontSize:11}}>{row.note||""}</td>
                          </tr>                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* -- SCHEDULE TAB */}
          {ptab === "schedule" && (
            <div>
              {/* Month navigator */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <button onClick={prevMonth2} style={{background:C.surface,border:"1.5px solid "+C.border,borderRadius:8,color:C.accent,fontSize:14,cursor:"pointer",padding:"5px 12px",fontFamily:"inherit"}}>{"<"}</button>
                <div style={{flex:1,textAlign:"center",color:C.tp,fontWeight:800,fontSize:16}}>{MONTHS_NAMES[pmo]} {pyr}</div>
                <button onClick={nextMonth2} style={{background:C.surface,border:"1.5px solid "+C.border,borderRadius:8,color:C.accent,fontSize:14,cursor:"pointer",padding:"5px 12px",fontFamily:"inherit"}}>{">"}</button>
              </div>

              {/* My stats for the month */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                {[
                  ["Working Days", workDays+"/"+daysInMonth, C.accent],
                  ["Total Hours",  totalHrs+"h",             C.green],
                  ["Net hrs/Day",  netHrs.toFixed(1)+"h",    C.purple],
                ].map(function(item){
                  return (
                    <div key={item[0]} style={{background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"12px 14px",textAlign:"center",borderTop:"3px solid "+item[2]}}>
                      <div style={{color:item[2],fontWeight:900,fontSize:20}}>{item[1]}</div>
                      <div style={{color:C.ts,fontSize:10,fontWeight:600,marginTop:3}}>{item[0]}</div>
                    </div>                  );
                })}
              </div>

              {/* Work hours summary */}
              <Card style={{marginBottom:14,padding:"12px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                  <div style={S.rowG10}>
                    <div style={{width:10,height:10,borderRadius:2,background:C.green,flexShrink:0}} />
                    <span style={{color:C.tp,fontSize:12,fontWeight:700}}>Shift Hours</span>
                    <span style={S.ts12}>{empWh.start} - {empWh.end}</span>
                    <span style={S.ts12}>({empWh.brk} min break)</span>
                  </div>
                  {empWh.flexible && <span style={{background:C.accentL,color:C.accent,fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:8}}>Flexible Hours</span>}
                </div>
              </Card>

              {/* Calendar */}
              <Card noPad style={{overflow:"hidden"}}>
                {/* Day headers */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:C.surface,borderBottom:"1px solid "+C.border}}>
                  {DAYS_SHORT.map(function(d){
                    var isWknd = d==="Sat"||d==="Sun";
                    return <div key={d} style={{textAlign:"center",padding:"8px 4px",color:isWknd?C.amber:C.ts,fontWeight:700,fontSize:11}}>{d}</div>;
                  })}
                </div>
                {/* Weeks */}
                <div style={{padding:8}}>
                  {calGrid.map(function(week,wi){
                    return (
                      <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
                        {week.map(function(day,di){
                          if (!day) return <div key={di} style={{minHeight:70}} />;
                          var today = new Date(); var isToday = day===today.getDate()&&pmo===today.getMonth()&&pyr===today.getFullYear();
                          var isWknd = di===5||di===6;
                          var shiftId = getShift(day);
                          var shift = getShiftObj(shiftId);
                          var isOff = shiftId === "off";
                          return (
                            <div key={di} style={{minHeight:70,border:"1.5px solid "+(isToday?C.accent:isOff?"#E2E8F0":shift.color+"44"),borderRadius:8,padding:"5px 6px",background:isToday?C.accentL:isOff?C.surface:shift.color+"0D",overflow:"hidden"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                <span style={{fontWeight:isToday?800:600,fontSize:12,color:isToday?C.accent:isWknd?C.amber:C.tp,background:isToday?C.accent+"22":"transparent",borderRadius:"50%",width:20,height:20,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{day}</span>
                              </div>
                              {isOff ? (
                                <div style={{color:"#94A3B8",fontSize:9,fontWeight:600,textAlign:"center",marginTop:4}}>Off</div>
                              ) : (
                                <div>
                                  <div style={{background:shift.color,borderRadius:4,padding:"2px 5px",marginBottom:3}}>
                                    <div style={{color:"#fff",fontSize:9,fontWeight:700}}>{shift.name}</div>
                                  </div>
                                  <div style={{color:shift.color,fontSize:9,fontWeight:600}}>{shift.start}</div>
                                  <div style={{color:C.ts,fontSize:8}}>{shift.end} (-{empWh.brk}m)</div>
                                </div>
                              )}
                            </div>                          );
                        })}
                      </div>                    );
                  })}
                </div>
                {/* Legend */}
                <div style={{padding:"8px 14px",background:C.surface,borderTop:"1px solid "+C.border,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                  {shiftPresets.map(function(s){
                    return (
                      <div key={s.id} style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:10,height:10,borderRadius:2,background:s.color}} />
                        <span style={S.ts10}>{s.name}{s.start?" ("+s.start+"-"+s.end+")":""}</span>
                      </div>                    );
                  })}
                </div>
              </Card>

              {/* Day-by-day list for current month */}
              <div style={{marginTop:14}}>
                <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:10}}>Schedule Detail - {MONTHS_NAMES[pmo]} {pyr}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
                  {(function(){
                    var cards = [];
                    for (var d3 = 1; d3 <= daysInMonth; d3++) {
                      var sid = getShift(d3);
                      var sh = getShiftObj(sid);
                      var jsD = new Date(pyr,pmo,d3).getDay();
                      var dkIdx = [6,0,1,2,3,4,5][jsD];
                      var dk = DAYS_SHORT[dkIdx];
                      var today2 = new Date(); var isTd = d3===today2.getDate()&&pmo===today2.getMonth()&&pyr===today2.getFullYear();
                      var dd = d3;
                      cards.push(
                        <div key={dd} style={{border:"1.5px solid "+(isTd?C.accent:sid==="off"?"#E2E8F0":sh.color+"55"),borderRadius:8,padding:"8px 10px",background:isTd?C.accentL:sid==="off"?"#F8FAFC":sh.color+"0D"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                            <span style={{color:isTd?C.accent:(dk==="Sat"||dk==="Sun")?C.amber:C.tp,fontWeight:700,fontSize:12}}>{dk} {d3}</span>
                            <span style={{background:sh.color+(sid==="off"?"22":""),color:sid==="off"?"#94A3B8":sh.color,fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:4}}>{sh.name}</span>
                          </div>
                          {sid !== "off" ? (
                            <div style={S.ts10}>{empWh.start} - {empWh.end}</div>
                          ) : (
                            <div style={{color:"#94A3B8",fontSize:10}}>Rest day</div>
                          )}
                        </div>                      );
                    }
                    return cards;
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* -- LEAVE TAB */}
          {ptab === "leave" && (
            <div>
              {/* ── Detail drawer */}
              {lvDetail && (
                <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
                  <Card style={{width:460,padding:28,maxHeight:"90vh",overflowY:"auto"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                      <div style={{color:C.tp,fontWeight:800,fontSize:16}}>Leave Application</div>
                      <button onClick={function(){setLvDetail(null);}} style={{background:"none",border:"none",color:C.ts,fontSize:22,cursor:"pointer",lineHeight:1,fontFamily:"inherit"}}>x</button>
                    </div>
                    <div style={{background:getLvColor(lvDetail.type)+"18",border:"1.5px solid "+getLvColor(lvDetail.type)+"44",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
                      <div style={{color:getLvColor(lvDetail.type),fontWeight:800,fontSize:16}}>{lvDetail.type}</div>
                      <div style={{color:C.tp,fontSize:13,marginTop:4}}>{lvDetail.from}{lvDetail.from!==lvDetail.to?" to "+lvDetail.to:""}</div>
                      <div style={{color:C.ts,fontSize:12,marginTop:2}}>{lvDetail.halfDay?"Half day ("+lvDetail.halfDaySlot+")":lvDetail.days+" day"+(lvDetail.days!==1?"s":"")}</div>
                    </div>
                    <div style={{marginBottom:10}}>
                      <div style={{color:C.ts,fontSize:11,fontWeight:700,marginBottom:4}}>REASON</div>
                      <div style={{color:C.tp,fontSize:13,padding:"8px 12px",background:C.surface,borderRadius:7}}>{lvDetail.reason}</div>
                    </div>
                    {lvDetail.docName && (
                      <div style={{marginBottom:10}}>
                        <div style={{color:C.ts,fontSize:11,fontWeight:700,marginBottom:6}}>ATTACHED DOCUMENT</div>
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:C.accentL,border:"1.5px solid "+C.accent+"44",borderRadius:8}}>
                          <span style={{fontSize:20}}>📎</span>
                          <span style={{color:C.accent,fontWeight:600,fontSize:12,flex:1}}>{lvDetail.docName}</span>
                          {lvDetail.docData && (
                            <a href={lvDetail.docData} download={lvDetail.docName} style={{color:C.accent,fontSize:11,fontWeight:700,textDecoration:"none",background:C.accent,color:"#fff",padding:"4px 10px",borderRadius:6}}>Download</a>
                          )}
                        </div>
                      </div>
                    )}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,paddingTop:14,borderTop:"1px solid "+C.border}}>
                      <div>
                        <div style={S.ts10}>Submitted {lvDetail.submittedOn}</div>
                        <StatusChip s={lvDetail.status} />
                      </div>
                      {lvDetail.status==="Pending" && (
                        <button onClick={function(){cancelApp(lvDetail.id);setLvDetail(null);}} style={{background:"#FEF2F2",color:"#DC2626",border:"1.5px solid #DC262644",borderRadius:8,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                          Cancel Application
                        </button>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {/* ── Balance cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
                {lvBalances.map(function(b){
                  var used = getUsed(b.name);
                  var remaining = Math.max(0, b.total - used);
                  var pct = Math.min(100, Math.round(used / b.total * 100));
                  return (
                    <Card key={b.name} style={{padding:"12px 10px",borderTop:"3px solid "+b.color}}>
                      <div style={{color:b.color,fontWeight:900,fontSize:22}}>{remaining}<span style={{fontSize:11,fontWeight:400,color:C.ts}}> left</span></div>
                      <div style={{color:C.ts,fontSize:9,fontWeight:700,marginTop:2}}>{b.name.split(" ")[0]+" "+b.name.split(" ")[1]}</div>
                      <div style={{background:C.border,borderRadius:3,height:4,marginTop:6}}>
                        <div style={{background:pct>80?"#DC2626":b.color,borderRadius:3,height:4,width:pct+"%"}} />
                      </div>
                      <div style={{color:C.ts,fontSize:9,marginTop:3}}>{used}/{b.total} used</div>
                    </Card>                  );
                })}
              </div>

              {/* ── View toggle */}
              <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
                <div style={S.rowG6}>
                  {[["list","My Applications"],["apply","Apply Leave"]].map(function(v){
                    var active = lvView===v[0];
                    return <button key={v[0]} onClick={function(){setLvView(v[0]); setLvErr({}); setLvSuccess(false);}} style={{background:active?"linear-gradient(135deg,"+C.accent+","+C.accentD+")":"transparent",color:active?"#fff":C.ts,border:"1.5px solid "+(active?C.accent+"66":C.border),borderRadius:9,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{active&&v[0]==="apply"?"+ ":""}{v[1]}</button>;
                  })}
                </div>
                {lvApps.filter(function(a){return a.status==="Pending";}).length > 0 && (
                  <span style={{background:C.amberL,color:C.amber,fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:8}}>
                    {lvApps.filter(function(a){return a.status==="Pending";}).length} pending
                  </span>
                )}
              </div>

              {/* ── APPLICATION LIST */}
              {lvView === "list" && (
                <Card noPad style={{overflow:"hidden"}}>
                  <div style={{padding:"10px 16px",background:C.surface,borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={S.tp13b}>Leave History</span>
                    <button onClick={function(){setLvView("apply");}} style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ New Application</button>
                  </div>
                  {lvApps.length === 0 && (
                    <div style={{padding:32,textAlign:"center",color:C.ts}}>No leave applications yet.</div>
                  )}
                  {lvApps.map(function(a, i){
                    var clr = getLvColor(a.type);
                    var statusBg = a.status==="Approved"?C.greenL:a.status==="Pending"?C.amberL:a.status==="Rejected"?"#FEF2F2":"#F1F5F9";
                    var statusClr = a.status==="Approved"?C.green:a.status==="Pending"?C.amber:a.status==="Rejected"?"#DC2626":C.ts;
                    return (
                      <div key={a.id} onClick={function(){setLvDetail(a);}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<lvApps.length-1?"1px solid "+C.border+"44":"none",cursor:"pointer",background:i%2===0?"transparent":"#FAFCFF"}}>
                        <div style={{width:4,height:48,borderRadius:2,background:clr,flexShrink:0}} />
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                            <span style={{color:clr,fontWeight:700,fontSize:13}}>{a.type}</span>
                            {a.docName && <span style={{fontSize:14}} title={a.docName}>📎</span>}
                            {a.halfDay && <span style={{background:clr+"22",color:clr,fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:4}}>Half Day</span>}
                          </div>
                          <div style={S.ts11}>{a.from}{a.from!==a.to?" - "+a.to:""} &middot; {a.halfDay?"0.5":a.days} day{a.days!==1?"s":""}</div>
                          <div style={{color:C.ts,fontSize:10,marginTop:2,fontStyle:"italic"}}>{a.reason.length>60?a.reason.slice(0,60)+"...":a.reason}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                          <span style={{background:statusBg,color:statusClr,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:8}}>{a.status}</span>
                          <span style={S.ts10}>{a.submittedOn}</span>
                        </div>
                      </div>                    );
                  })}
                </Card>
              )}

              {/* ── APPLICATION FORM */}
              {lvView === "apply" && (
                <div>
                  {lvSuccess && (
                    <div style={{padding:"14px 18px",background:"#D1FAE5",border:"1.5px solid #059669",borderRadius:10,marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:20}}>✅</span>
                      <div>
                        <div style={{color:"#047857",fontWeight:700,fontSize:14}}>Leave Application Submitted!</div>
                        <div style={{color:"#065F46",fontSize:12}}>Your application is pending HR/Manager approval. Redirecting...</div>
                      </div>
                    </div>
                  )}
                  <Card style={{padding:24}}>
                    <div style={{color:C.tp,fontWeight:800,fontSize:16,marginBottom:4}}>Apply for Leave</div>
                    <div style={{color:C.ts,fontSize:12,marginBottom:20}}>Complete the form below. Fields marked * are required.</div>

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                      {/* Leave Type */}
                      <div style={{gridColumn:"1 / -1"}}>
                        <label style={{color:C.ts,fontSize:11,fontWeight:700,display:"block",marginBottom:8}}>LEAVE TYPE *</label>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          {leaveTypes2.map(function(lt){
                            var active = lvForm.type===lt.name;
                            return (
                              <button key={lt.name} onClick={function(){setLF("type",lt.name);}} style={{padding:"8px 14px",borderRadius:9,border:"1.5px solid "+(active?lt.color:C.border),background:active?lt.color+"22":"transparent",color:active?lt.color:C.ts,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                                {lt.name}
                              </button>                            );
                          })}
                        </div>
                        {lvErr.type && <div style={{color:"#DC2626",fontSize:11,marginTop:4}}>{lvErr.type}</div>}
                      </div>

                      {/* Half day toggle */}
                      <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"center",gap:14}}>
                        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                          <input type="checkbox" checked={lvForm.halfDay||false} onChange={function(e){setLF("halfDay",e.target.checked);}} />
                          <span style={{color:C.tp,fontSize:13,fontWeight:600}}>Half Day Leave</span>
                        </label>
                        {lvForm.halfDay && (
                          <div style={S.rowG6}>
                            {["AM","PM"].map(function(slot){
                              var active = lvForm.halfDaySlot===slot;
                              return <button key={slot} onClick={function(){setLF("halfDaySlot",slot);}} style={{padding:"5px 16px",borderRadius:7,border:"1.5px solid "+(active?C.accent:C.border),background:active?C.accentL:"transparent",color:active?C.accent:C.ts,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{slot}</button>;
                            })}
                          </div>
                        )}
                      </div>

                      {/* Dates */}
                      <div>
                        <label style={S.ts11b}>FROM DATE *</label>
                        <input type="date" value={lvForm.from||""} onChange={function(e){setLF("from",e.target.value); if(!lvForm.to) setLF("to",e.target.value);}} style={Object.assign({},inputStyle,{marginBottom:0})} />
                        {lvErr.from && <div style={{color:"#DC2626",fontSize:11,marginTop:3}}>{lvErr.from}</div>}
                      </div>
                      <div>
                        <label style={S.ts11b}>{lvForm.halfDay?"DATE":"TO DATE"} *</label>
                        <input type="date" value={lvForm.to||""} min={lvForm.from||""} onChange={function(e){setLF("to",e.target.value);}} disabled={lvForm.halfDay} style={Object.assign({},inputStyle,{marginBottom:0,opacity:lvForm.halfDay?0.6:1})} />
                        {lvErr.to && <div style={{color:"#DC2626",fontSize:11,marginTop:3}}>{lvErr.to}</div>}
                      </div>

                      {/* Days preview */}
                      {(lvForm.from && lvForm.to) && (
                        <div style={{gridColumn:"1 / -1",padding:"10px 14px",background:C.accentL,border:"1.5px solid "+C.accent+"44",borderRadius:8,display:"flex",alignItems:"center",gap:12}}>
                          <span style={{color:C.accent,fontWeight:900,fontSize:22}}>{lvForm.halfDay?"0.5":calcDays(lvForm.from,lvForm.to)}</span>
                          <div>
                            <div style={{color:C.accent,fontWeight:700,fontSize:13}}>day{lvForm.halfDay||calcDays(lvForm.from,lvForm.to)===1?"":"s"} of {lvForm.type}</div>
                            <div style={S.ts11}>{lvForm.halfDay?"Half "+lvForm.halfDaySlot+" on "+lvForm.from:lvForm.from+(lvForm.from!==lvForm.to?" to "+lvForm.to:"")}</div>
                          </div>
                        </div>
                      )}

                      {/* Reason */}
                      <div style={{gridColumn:"1 / -1"}}>
                        <label style={S.ts11b}>REASON *</label>
                        <textarea value={lvForm.reason||""} onChange={function(e){setLF("reason",e.target.value);}} rows={3} placeholder="Briefly describe your reason for leave..." style={Object.assign({},inputStyle,{resize:"vertical",fontFamily:"inherit",lineHeight:1.6,marginBottom:0})} />
                        {lvErr.reason && <div style={{color:"#DC2626",fontSize:11,marginTop:3}}>{lvErr.reason}</div>}
                      </div>

                      {/* Document upload */}
                      <div style={{gridColumn:"1 / -1"}}>
                        {(function(){
                          var lvLt = leaveTypes2.find(function(t){return t.name===lvForm.type;});
                          var docRequired = lvLt && lvLt.requireDoc;
                          return (
                            <label style={S.ts11b}>
                              SUPPORTING DOCUMENT
                              {docRequired
                                ? <span style={{color:"#DC2626"}}> * (Required for {lvForm.type})</span>
                                : <span style={{color:C.ts}}> (Optional)</span>                              }
                            </label>                          );
                        })()}
                        {!lvForm.docName ? (
                          <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:"20px 16px",border:"2px dashed "+C.border,borderRadius:10,cursor:"pointer",background:C.surface}}>
                            <span style={{fontSize:28}}>📎</span>
                            <div style={{textAlign:"center"}}>
                              <div style={{color:C.tp,fontWeight:600,fontSize:13}}>Click to upload document</div>
                              <div style={{color:C.ts,fontSize:11,marginTop:2}}>MC, hospitalisation cert, or other supporting docs</div>
                              <div style={{color:C.ts,fontSize:10,marginTop:1}}>PDF, JPG, PNG up to 5MB</div>
                            </div>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocUpload} style={{display:"none"}} />
                          </label>
                        ) : (
                          <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:C.greenL,border:"1.5px solid "+C.green+"44",borderRadius:8}}>
                            <span style={{fontSize:22}}>📄</span>
                            <div style={{flex:1}}>
                              <div style={{color:C.green,fontWeight:700,fontSize:13}}>{lvForm.docName}</div>
                              <div style={{color:C.ts,fontSize:10,marginTop:1}}>Ready to submit</div>
                            </div>
                            <button onClick={function(){setLvForm(function(f){return Object.assign({},f,{docName:"",docData:null,docType:""});});}} style={{background:"#FEF2F2",color:"#DC2626",border:"none",borderRadius:6,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>
                          </div>
                        )}
                        {lvErr.doc && <div style={{color:"#DC2626",fontSize:11,marginTop:4}}>{lvErr.doc}</div>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,paddingTop:16,borderTop:"1px solid "+C.border}}>
                      <button onClick={function(){setLvView("list"); setLvErr({});}} style={{background:C.surface,color:C.ts,border:"1.5px solid "+C.border,borderRadius:9,padding:"10px 20px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                      <button onClick={submitLeave} disabled={lvSubmitting} style={{background:lvSubmitting?"#94A3B8":"linear-gradient(135deg,"+C.accent+","+C.accentD+")",color:"#fff",border:"none",borderRadius:9,padding:"10px 24px",fontSize:12,fontWeight:700,cursor:lvSubmitting?"wait":"pointer",fontFamily:"inherit"}}>
                        {lvSubmitting?"Submitting...":"Submit Application"}
                      </button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {ptab === "documents" && (
            <div>
              <div style={S.mb16}>
                <div style={S.tp14b}>My Documents</div>
                <div style={{color:C.ts,fontSize:12,marginTop:2}}>Download your tax forms, income statements and employment letters.</div>
              </div>

              {/* Borang EA section */}
              <Card style={{marginBottom:14,borderLeft:"4px solid #1E40AF"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <div style={{color:"#1E40AF",fontWeight:800,fontSize:14}}>Borang EA / CP8A</div>
                    <div style={{color:C.ts,fontSize:11,marginTop:2}}>Annual income statement for tax filing (Borang BE). Issued by employer by 28 Feb each year.</div>
                  </div>
                  <span style={{background:"#EFF6FF",color:"#1E40AF",fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:8}}>Available</span>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[2024,2025].map(function(yr){
                    var eaData = buildEA(emp, yr);
                    return(
                      <button key={yr} onClick={function(){
                        var w = window.open("","_blank");
                        if (w) {
                          var co = {name:"TechCorp Sdn. Bhd.",regNo:"123456-A",addr1:"Level 5, Menara Tech",city:"Kuala Lumpur"};
                          var rm2 = function(v){return "RM "+parseFloat(v||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");};
                          w.document.write(
                            "<html><head><title>Borang EA "+yr+"</title><style>body{font-family:Arial,sans-serif;padding:30px;max-width:680px;margin:0 auto}h1{color:#1E40AF;font-size:16px;border-bottom:2px solid #1E40AF;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin-bottom:14px}td{padding:6px 10px;font-size:12px;border-bottom:1px solid #E2E8F0}.section{background:#EFF6FF;font-weight:700;color:#1E40AF;padding:6px 10px;font-size:11px}.total{font-weight:700;background:#F0FDF4}.footer{font-size:9px;color:#9CA3AF;text-align:center;margin-top:16px;border-top:1px solid #E2E8F0;padding-top:8px}@media print{body{padding:10px}}</style></head><body>"
                            +"<h1>BORANG EA / CP8A - TAHUN "+yr+"</h1>"
                            +"<p style='font-size:11px;color:#374151'>Penyata Saraan Bagi Pekerja Swasta / Statement of Remuneration for Private Sector Employee</p>"
                            +"<table><tr class='section'><td colspan='2'>BAHAGIAN A - MAKLUMAT MAJIKAN</td></tr>"
                            +"<tr><td>Nama Majikan</td><td>"+co.name+"</td></tr>"
                            +"<tr><td>No. Pendaftaran</td><td>"+co.regNo+"</td></tr>"
                            +"<tr class='section'><td colspan='2'>BAHAGIAN B - MAKLUMAT PEKERJA</td></tr>"
                            +"<tr><td>Nama Pekerja</td><td>"+emp.name+"</td></tr>"
                            +"<tr><td>No. Pekerja</td><td>"+(emp.empNo||emp.id)+"</td></tr>"
                            +"<tr><td>No. Kad Pengenalan</td><td>"+(emp.nric||"-")+"</td></tr>"
                            +"<tr><td>No. Cukai Pendapatan</td><td>"+(emp.taxNo||"-")+"</td></tr>"
                            +"<tr><td>No. KWSP</td><td>"+(emp.epfNo||"-")+"</td></tr>"
                            +"<tr class='section'><td colspan='2'>BAHAGIAN C - PENDAPATAN PENGGAJIAN (TAHUNAN)</td></tr>"
                            +"<tr><td>Gaji Pokok</td><td>"+rm2(eaData.annualBasic)+"</td></tr>"
                            +"<tr><td>Elaun Perjalanan</td><td>"+rm2(eaData.annualTravel)+"</td></tr>"
                            +"<tr><td>Elaun Lain</td><td>"+rm2(eaData.annualOther)+"</td></tr>"
                            +"<tr class='total'><td>JUMLAH SARAAN KASAR</td><td>"+rm2(eaData.annualGross)+"</td></tr>"
                            +"<tr class='section'><td colspan='2'>BAHAGIAN D - CARUMAN BERKANUN</td></tr>"
                            +"<tr><td>Caruman KWSP (Pekerja)</td><td>"+rm2(eaData.annualEpfEe)+"</td></tr>"
                            +"<tr><td>Caruman PERKESO (Pekerja)</td><td>"+rm2(eaData.annualSocsoEe)+"</td></tr>"
                            +"<tr class='section'><td colspan='2'>BAHAGIAN E - CUKAI DIPOTONG (PCB/MTD)</td></tr>"
                            +"<tr class='total'><td>Jumlah PCB Dipotong</td><td>"+rm2(eaData.annualPCB)+"</td></tr>"
                            +"</table>"
                            +"<div class='footer'>Borang EA dikeluarkan mengikut seksyen 83(1A) Akta Cukai Pendapatan 1967. Tahun Taksiran: "+yr+"<br/>Sila simpan untuk rujukan percukaian anda / Please retain for tax filing purposes.</div>"
                            +"<script>window.onload=function(){window.print();}<\/script>"
                            +"</body></html>"
                          );
                          w.document.close();
                        }
                      }} style={{background:"linear-gradient(135deg,#1E40AF,#1D4ED8)",color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        Download EA {yr}
                      </button>                    );
                  })}
                </div>
                <div style={{marginTop:10,padding:"8px 12px",background:"#FFFBEB",borderRadius:7,color:"#92400E",fontSize:10}}>
                  Use your Borang EA to complete your annual Borang BE (personal tax return) on MyTax portal at mytax.hasil.gov.my
                </div>
              </Card>

              {/* Other documents */}
              <Card style={{marginBottom:14}}>
                <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:12}}>Employment Documents</div>
                {[
                  {name:"Offer Letter",         icon:<FileText size={16}/>, year:"Upon joining",    available:true},
                  {name:"Confirmation Letter",   icon:<CheckCircle size={16}/>, year:"After probation", available:!!(emp.confirmDate)},
                  {name:"Latest Salary Slip",    icon:<DollarSign size={16}/>, year:"Current month",   available:true},
                  {name:"EPF Statement (KWSP)",  icon:<Building2 size={16}/>, year:"Annual",          available:false, note:"Download from i-Akaun portal"},
                  {name:"SOCSO Statement",       icon:<ShieldCheck size={16}/>,year:"Annual",          available:false, note:"Download from PERKESO portal"},
                ].map(function(doc,i){return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<4?"1px solid "+C.border+"44":"none"}}>
                    <span style={{fontSize:20}}>{doc.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{color:C.tp,fontWeight:600,fontSize:12}}>{doc.name}</div>
                      <div style={{color:C.ts,fontSize:10,marginTop:1}}>{doc.note||doc.year}</div>
                    </div>
                    {doc.available
                      ? <span style={{background:C.greenL,color:C.green,fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:6,cursor:"pointer"}}>Download</span>
                      : <span style={{background:C.surface,color:C.ts,fontSize:10,padding:"4px 10px",borderRadius:6}}>External</span>                    }
                  </div>                );})}
              </Card>

              {/* Tax reference quick links */}
              <Card>
                <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:10}}>Tax Filing Quick Reference</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[
                    {label:"Tax File No.",  value:emp.taxNo||"Not assigned",  color:C.purple},
                    {label:"LHDN Branch",   value:emp.taxBranch||"-",         color:C.ts},
                    {label:"EPF No.",       value:emp.epfNo||"-",             color:"#0EA5C9"},
                    {label:"SOCSO No.",     value:emp.socsoNo||"-",           color:"#059669"},
                  ].map(function(item){return(
                    <div key={item.label} style={{background:C.surface,borderRadius:8,padding:"8px 12px"}}>
                      <div style={S.ts10b}>{item.label}</div>
                      <div style={{color:item.color,fontWeight:700,fontSize:12,marginTop:2}}>{item.value}</div>
                    </div>                  );})}
                </div>
              </Card>
            </div>
          )}

          {/* ── TEAM APPROVALS TAB ─────────────────────────────────────────── */}
          {ptab === "approvals" && (
            <div>
              {/* Header with reminder info */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div style={S.tp14b}>Team Leave Approvals</div>
                  <div style={{color:C.ts,fontSize:12,marginTop:2}}>
                    Manage leave requests from your {mySubordinates.length} direct report{mySubordinates.length!==1?"s":""}.
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  {myPendingLeaves.length > 0 ? (
                    <span style={{background:C.amberL,color:C.amber,border:"1px solid "+C.amber+"55",fontWeight:700,fontSize:11,padding:"4px 12px",borderRadius:8}}>
                      {myPendingLeaves.length} Pending
                    </span>
                  ) : (
                    <span style={{background:C.greenL,color:C.green,border:"1px solid "+C.green+"55",fontWeight:700,fontSize:11,padding:"4px 12px",borderRadius:8}}>
                      ✓ All Clear
                    </span>
                  )}
                </div>
              </div>

              {/* Daily reminder status */}
              <div style={{background:"#EFF6FF",border:"1.5px solid "+C.accent+"33",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:reminderLog.length>0?8:0}}>
                  <span style={{fontSize:18}}>📧</span>
                  <div style={{flex:1}}>
                    <div style={{color:C.accent,fontWeight:700,fontSize:12}}>Daily Reminder: {reminderActive?"Active":"Paused"}</div>
                    <div style={{color:C.ts,fontSize:10,marginTop:1}}>
                      Auto-email sent to <b>{emp.workEmail||emp.email||"you"}</b> every day when there are pending approvals.
                      {" "}In demo mode, reminders fire every 30 seconds.
                    </div>
                  </div>
                  <button
                    onClick={function(){ setReminderActive(function(v){ return !v; }); }}
                    style={{background:reminderActive?C.green:C.surface,color:reminderActive?"#fff":C.ts,border:"1.5px solid "+(reminderActive?C.green:C.border),borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                  >
                    {reminderActive?"On":"Off"}
                  </button>
                </div>
                {reminderLog.length > 0 && (
                  <div style={{marginTop:4,borderTop:"1px solid "+C.accent+"22",paddingTop:6}}>
                    <div style={{color:C.ts,fontSize:10,fontWeight:700,marginBottom:4}}>REMINDER LOG</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:80,overflowY:"auto"}}>
                      {reminderLog.map(function(r){
                        return (
                          <div key={r.id} style={{fontSize:10,color:C.ts,display:"flex",gap:8}}>
                            <span style={{color:C.accent,fontWeight:600,minWidth:45}}>{r.time}</span>
                            <span>📧 Reminder sent — {r.count} pending leave{r.count>1?"s":""}: <b>{r.names}</b></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* My team members */}
              <div style={{marginBottom:14}}>
                <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:0.8,marginBottom:8}}>MY DIRECT REPORTS</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {mySubordinates.map(function(s){
                    var subPending = globalLeaves.filter(function(l){ return l.empId===s.id && l.status==="Pending"; }).length;
                    return (
                      <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,background:C.card,border:"1.5px solid "+(subPending?C.amber+"66":C.border),borderRadius:9,padding:"7px 12px"}}>
                        <Avatar name={s.name} size={26} />
                        <div>
                          <div style={{fontSize:11,fontWeight:600,color:C.tp}}>{s.name}</div>
                          <div style={{fontSize:9,color:C.ts}}>{s.position||s.role}</div>
                        </div>
                        {subPending > 0 && (
                          <span style={{background:C.amber,color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{subPending}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pending approvals */}
              {myPendingLeaves.length === 0 ? (
                <div style={{padding:"32px 0",textAlign:"center",background:C.greenL,borderRadius:12,border:"1.5px solid "+C.green+"44"}}>
                  <div style={{fontSize:28,marginBottom:8}}>✅</div>
                  <div style={{color:C.green,fontWeight:700,fontSize:14}}>No pending approvals</div>
                  <div style={{color:C.ts,fontSize:12,marginTop:4}}>All leave requests from your team have been actioned.</div>
                </div>
              ) : (
                <div>
                  <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:0.8,marginBottom:10}}>PENDING APPROVAL ({myPendingLeaves.length})</div>
                  {myPendingLeaves.map(function(l){
                    var clr = l.typeColor || "#0EA5C9";
                    var noteVal = approvalNote[l.id] || "";
                    var sub = allEmployees.find(function(e){ return e.id===l.empId; });
                    return (
                      <div key={l.id} style={{background:C.card,border:"2px solid "+C.amber+"55",borderLeft:"4px solid "+C.amber,borderRadius:12,marginBottom:14,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
                        {/* Card header */}
                        <div style={{background:"linear-gradient(90deg,"+C.amberL+","+C.card+")",padding:"12px 18px",borderBottom:"1px solid "+C.border+"44",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{display:"flex",alignItems:"center",gap:12}}>
                            <Avatar name={l.name} size={38} />
                            <div>
                              <div style={S.tp14b}>{l.name}</div>
                              <div style={S.ts11}>{l.empNo||l.empId} · {l.dept}</div>
                            </div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <span style={{background:C.amberL,color:C.amber,fontWeight:700,fontSize:11,padding:"4px 10px",borderRadius:7,border:"1px solid "+C.amber+"44",display:"block",marginBottom:3}}>⏳ Pending Approval</span>
                            <span style={{color:C.ts,fontSize:10}}>Submitted {l.submittedOn||"-"}</span>
                          </div>
                        </div>

                        <div style={{padding:"14px 18px"}}>
                          {/* Detail grid */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                            {[
                              ["Leave Type", l.type, clr],
                              ["Duration",   l.days+" day"+(l.days!==1?"s":""), C.accent],
                              ["Dates",      l.from+(l.from!==l.to?" → "+l.to:""), C.tp],
                            ].map(function(item){return(
                              <div key={item[0]} style={{background:C.surface,borderRadius:7,padding:"7px 10px"}}>
                                <div style={S.ts9b}>{item[0]}</div>
                                <div style={{color:item[2],fontWeight:700,fontSize:11,marginTop:2}}>{item[1]}</div>
                              </div>
                            );})}
                          </div>

                          {/* Reason */}
                          {(l.note||l.reason) && (
                            <div style={{marginBottom:10,padding:"8px 12px",background:C.surface,borderRadius:8,borderLeft:"3px solid "+C.border}}>
                              <div style={{color:C.ts,fontSize:9,fontWeight:700,marginBottom:2}}>REASON</div>
                              <div style={{color:C.tp,fontSize:12}}>{l.note||l.reason}</div>
                            </div>
                          )}

                          {/* Document */}
                          {l.docName ? (
                            <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:C.greenL,borderRadius:8,border:"1px solid "+C.green+"44"}}>
                              <span style={{fontSize:15}}>📎</span>
                              <div style={{flex:1}}>
                                <div style={{color:C.green,fontWeight:700,fontSize:11}}>{l.docName}</div>
                                <div style={S.ts10}>Supporting document attached</div>
                              </div>
                              <span style={{background:C.green,color:"#fff",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:5}}>MC/CERT</span>
                            </div>
                          ) : (
                            <div style={{marginBottom:10,padding:"6px 12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border+"44",color:C.ts,fontSize:11}}>
                              📋 No supporting document
                            </div>
                          )}

                          {/* Auto-email preview */}
                          <div style={{background:"#F0F7FF",border:"1px solid "+C.accent+"33",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                              <span style={{fontSize:13}}>📧</span>
                              <span style={{color:C.accent,fontWeight:700,fontSize:11}}>Daily reminder email preview</span>
                            </div>
                            <div style={{fontSize:10,color:C.ts,lineHeight:1.7,background:"#fff",borderRadius:6,padding:"8px 10px"}}>
                              <div><b>To:</b> {emp.workEmail||emp.email||"manager@company.com"}</div>
                              <div><b>Subject:</b> [Reminder] Pending Leave Approval — {l.name} ({l.type})</div>
                              <div style={{marginTop:4,color:C.tp}}>
                                Dear {emp.name}, this is a daily reminder that <b>{l.name}</b> has a pending <b>{l.type}</b> request
                                ({l.from}{l.from!==l.to?" to "+l.to:""}, {l.days} day{l.days!==1?"s":""}) awaiting your approval.
                                Please action it in your HR portal.
                              </div>
                            </div>
                          </div>

                          {/* Rejection reason */}
                          <div style={{marginBottom:10}}>
                            <div style={{color:C.ts,fontSize:10,marginBottom:4}}>Remarks / reason (optional for rejection):</div>
                            <input
                              value={noteVal}
                              onChange={function(e){ setApprovalNote(function(prev){ var n=Object.assign({},prev); n[l.id]=e.target.value; return n; }); }}
                              placeholder="e.g. Insufficient leave balance, peak period, etc."
                              style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid "+C.border,fontSize:11,fontFamily:"inherit",background:C.surface,color:C.tp}}
                            />
                          </div>

                          {/* Action buttons */}
                          <div style={{display:"flex",gap:10}}>
                            <button
                              onClick={function(){ approveLeave(l.id); }}
                              style={{flex:1,background:"linear-gradient(135deg,"+C.green+",#047857)",color:"#fff",border:"none",borderRadius:9,padding:"11px 0",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={function(){ rejectLeave(l.id, noteVal); }}
                              style={{flex:1,background:"linear-gradient(135deg,#DC2626,#B91C1C)",color:"#fff",border:"none",borderRadius:9,padding:"11px 0",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recently actioned by this manager */}
              {(function(){
                var actioned = globalLeaves.filter(function(l){
                  return (l.approvedBy===emp.name || l.rejectedBy===emp.name) && l.status!=="Pending";
                });
                if (actioned.length===0) return null;
                return (
                  <div style={{marginTop:20}}>
                    <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:0.8,marginBottom:8}}>RECENTLY ACTIONED BY YOU</div>
                    <Card noPad style={{overflow:"hidden"}}>
                      {actioned.slice(0,6).map(function(l,i){
                        var isApproved = l.status==="Approved";
                        return (
                          <div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:i<actioned.length-1?"1px solid "+C.border+"44":"none",background:i%2===0?"transparent":"#FAFCFF"}}>
                            <Avatar name={l.name} size={28} />
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,fontWeight:600,color:C.tp}}>{l.name}</div>
                              <div style={{fontSize:10,color:C.ts}}>{l.type} · {l.from}{l.from!==l.to?" to "+l.to:""} ({l.days}d)</div>
                            </div>
                            <span style={{background:isApproved?C.greenL:C.redL,color:isApproved?C.green:C.red,fontWeight:700,fontSize:10,padding:"3px 10px",borderRadius:6}}>
                              {isApproved?"✓ Approved":"✗ Rejected"}
                            </span>
                            <span style={{color:C.ts,fontSize:10}}>{isApproved?(l.approvedOn||""):(l.rejectedOn||"")}</span>
                          </div>
                        );
                      })}
                    </Card>
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </div>
    </div>  );
}

// -- SETUP MODULE

// ═══════════════════════════════════════════════════════════════
//  IMPORT MODULE v2 — Full data upload centre for HRCloud
// ═══════════════════════════════════════════════════════════════
function ImportModule(props) {
  var setEmployees     = props.setEmployees     || function(){};
  var setGlobalLeaves  = props.setGlobalLeaves  || function(){};
  var setGlobalBatches = props.setGlobalBatches || function(){};
  var setGWh           = props.setGWh           || function(){};
  var employees        = props.employees        || [];

  var [mainTab, setMainTab]   = useState("upload");   // upload | preview | guide
  var [dragOver, setDragOver] = useState(false);
  var [files, setFiles]       = useState([]);
  var [selFile, setSelFile]   = useState(null);       // index of file being previewed
  var [importing, setImporting] = useState(false);
  var [importLog, setImportLog] = useState([]);       // [{type,msg}]
  var [summary, setSummary]   = useState(null);
  var [confirmClear, setConfirmClear] = useState(false);

  // ── Sheet type detection
  function detectType(name) {
    var n = (name||"").toLowerCase().replace(/[^a-z0-9]/g," ");
    if(/employee|staff|worker|personnel/.test(n))               return "employees";
    if(/attend|clock|punch|timesheet|time sheet/.test(n))       return "attendance";
    if(/payroll|salary|pay hist|payslip/.test(n))               return "payroll";
    if(/leave bal|opening|ytd|balance/.test(n))                 return "opening";
    if(/leave|annual|sick/.test(n))                             return "leave";
    if(/schedule|shift|work hour/.test(n))                      return "schedule";
    if(/holiday|public hol/.test(n))                            return "holiday";
    return "unknown";
  }

  var TYPE_META = {
    employees:  {label:"👤 Employees",      color:C.accent,  bg:C.accentL},
    attendance: {label:"⏰ Attendance",      color:C.green,   bg:C.greenL},
    payroll:    {label:"💰 Payroll History", color:C.green,   bg:C.greenL},
    leave:      {label:"🌴 Leave Records",   color:C.purple,  bg:C.purpleL},
    opening:    {label:"💳 Opening Balances",color:C.amber,   bg:C.amberL},
    schedule:   {label:"📅 Work Schedule",   color:C.amber,   bg:C.amberL},
    holiday:    {label:"🏖 Public Holidays", color:C.green,   bg:C.greenL},
    unknown:    {label:"❓ Unknown",         color:C.red,     bg:C.redL},
  };

  // ── CSV parser (handles quoted commas)
  function parseCSV(text) {
    var lines = text.split(/\r?\n/);
    var rows = [];
    for(var i=0;i<lines.length;i++){
      var ln=lines[i].trim(); if(!ln) continue;
      var cols=[]; var cur=""; var inQ=false;
      for(var j=0;j<ln.length;j++){
        var ch=ln[j];
        if(ch==='"'){inQ=!inQ;}
        else if(ch===','&&!inQ){cols.push(cur.trim());cur="";}
        else cur+=ch;
      }
      cols.push(cur.trim());
      rows.push(cols);
    }
    if(rows.length<2) return [];
    var hdrs=rows[0].map(function(h){return h.replace(/^"|"$/g,"");});
    return rows.slice(1).filter(function(r){return r.some(function(v){return v.trim();});}).map(function(r){
      var obj={};
      hdrs.forEach(function(h,i){obj[h]=(r[i]||"").replace(/^"|"$/g,"");});
      return obj;
    });
  }

  // ── Validate a row and return array of issues
  function validateRow(row, type) {
    var issues=[];
    if(type==="employees"){
      if(!row["Employee ID"]) issues.push("Missing Employee ID");
      if(!row["Full Name"])   issues.push("Missing Full Name");
      if(!row["Basic Salary"]||isNaN(parseFloat(row["Basic Salary"]))) issues.push("Invalid Basic Salary");
      if(row["Date of Birth"] && !/^\d{4}-\d{2}-\d{2}$/.test(row["Date of Birth"])) issues.push("DOB must be YYYY-MM-DD");
      if(row["Join Date"] && !/^\d{4}-\d{2}-\d{2}$/.test(row["Join Date"])) issues.push("Join Date must be YYYY-MM-DD");
    } else if(type==="attendance"){
      if(!row["Employee ID"]) issues.push("Missing Employee ID");
      if(!row["Date"]) issues.push("Missing Date");
      else if(!/^\d{4}-\d{2}-\d{2}$/.test(row["Date"])) issues.push("Date must be YYYY-MM-DD");
      if(!row["Status"]) issues.push("Missing Status");
    } else if(type==="payroll"){
      if(!row["Period"])      issues.push("Missing Period (YYYY-MM)");
      if(!row["Employee ID"]) issues.push("Missing Employee ID");
      if(!row["Gross Total"]||isNaN(parseFloat(row["Gross Total"]))) issues.push("Invalid Gross Total");
    } else if(type==="leave"){
      if(!row["Employee ID"]) issues.push("Missing Employee ID");
      if(!row["Leave Type"])  issues.push("Missing Leave Type");
      if(!row["Date From"])   issues.push("Missing Date From");
      if(!row["Date To"])     issues.push("Missing Date To");
    } else if(type==="opening"){
      if(!row["Employee ID"]) issues.push("Missing Employee ID");
      if(!row["YTD Gross"]||isNaN(parseFloat(row["YTD Gross"]))) issues.push("Invalid YTD Gross");
    }
    return issues;
  }

  // ── Process files (supports CSV; xlsx via SheetJS)
  async function processFiles(fileList) {
    var newFiles=[];
    for(var i=0;i<fileList.length;i++){
      var f=fileList[i];
      var nm=f.name; var ext=nm.split(".").pop().toLowerCase();
      if(!["csv","xlsx","xls"].includes(ext)){
        newFiles.push({id:Date.now()+i,name:nm,type:"unknown",rows:[],status:"error",error:"Unsupported format — use .xlsx or .csv"});
        continue;
      }
      try {
        if(ext==="csv"){
          var txt=await f.text();
          var rows=parseCSV(txt);
          var type=detectType(nm);
          var issues=rows.map(function(r){return validateRow(r,type);});
          var errCount=issues.filter(function(is){return is.length>0;}).length;
          newFiles.push({id:Date.now()+i,name:nm,type:type,rows:rows,issues:issues,status:errCount>0?"warning":"ready",
            warning:errCount>0?(errCount+" rows have issues"):null,error:null});
        } else {
          // XLSX
          if(window.XLSX){
            var buf=await f.arrayBuffer();
            var wb2=window.XLSX.read(buf,{type:"array"});
            wb2.SheetNames.forEach(function(sn,si){
              var sType=detectType(sn);
              var ws2=wb2.Sheets[sn];
              var data=window.XLSX.utils.sheet_to_json(ws2,{defval:""});
              if(!data.length) return;
              var issues=data.map(function(r){return validateRow(r,sType);});
              var errCount=issues.filter(function(is){return is.length>0;}).length;
              newFiles.push({id:Date.now()+i*100+si,name:sn+" ("+nm+")",type:sType,rows:data,
                issues:issues,status:errCount>0?"warning":"ready",
                warning:errCount>0?(errCount+" rows have issues"):null,error:null});
            });
          } else {
            newFiles.push({id:Date.now()+i,name:nm,type:detectType(nm),rows:[],status:"warning",
              warning:"SheetJS not loaded — export each sheet as .csv for upload"});
          }
        }
      } catch(e){
        newFiles.push({id:Date.now()+i,name:nm,type:"unknown",rows:[],status:"error",error:e.message});
      }
    }
    setFiles(function(prev){return prev.concat(newFiles);});
    if(newFiles.length>0) setMainTab("upload");
  }

  // ── Map helpers
  function g(row){var args=Array.from(arguments).slice(1);for(var k of args){if(row[k]!==undefined&&row[k]!=="")return row[k];}return "";}
  function gn(row){var keys=Array.from(arguments).slice(1);var v=g.apply(null,[row].concat(keys));return parseFloat(v)||0;}
  function gb(row){var keys=Array.from(arguments).slice(1);var v=g.apply(null,[row].concat(keys));return v==="Yes"||v===true||v==="1";}

  function rowToEmployee(row){
    var id=(g(row,"Employee ID","employee_id","id")||"").trim();
    var nm=(g(row,"Full Name","name")||"").trim();
    if(!id||!nm) return null;
    var dobStr=g(row,"Date of Birth","dob")||"";
    var age=dobStr?Math.floor((new Date()-new Date(dobStr))/(365.25*86400000)):0;
    return Object.assign({},window._EMPTY_EMP_BASE||{},{
      id,empNo:g(row,"Emp No","empNo")||id,name:nm,
      preferredName:g(row,"Preferred Name","preferredName"),
      gender:g(row,"Gender")||"Male",dob:dobStr,
      nric:g(row,"NRIC / Passport","NRIC / IC","nric"),
      nationality:g(row,"Nationality")||"Malaysian",
      race:g(row,"Race"),religion:g(row,"Religion"),
      maritalStatus:g(row,"Marital Status","maritalStatus")||"Single",
      spouseName:g(row,"Spouse Name","spouseName"),
      spouseNric:g(row,"Spouse NRIC","spouseNric"),
      children:parseInt(g(row,"No. of Children","children"))||0,
      spouseRelief:gb(row,"Spouse Employed","spouseRelief"),
      pcbChildren:parseInt(g(row,"PCB Children","pcbChildren"))||0,
      spouseDisabled:gb(row,"Spouse Disabled","spouseDisabled"),
      dept:g(row,"Department","dept"),grade:g(row,"Grade","grade"),
      role:g(row,"Role","role")||"Staff",
      position:g(row,"Job Title","Position/Job Title","position"),
      employmentType:g(row,"Employment Type","employmentType")||"Permanent",
      joinDate:g(row,"Join Date","joinDate"),
      confirmDate:g(row,"Confirm Date","confirmDate"),
      resignDate:g(row,"Resign Date","resignDate"),
      status:g(row,"Status","status")||"Active",
      managerId:g(row,"Manager ID","managerId")||null,
      basic:gn(row,"Basic Salary","basic"),
      travelAllow:gn(row,"Travel Allowance","travelAllow"),
      supportAllow:gn(row,"Support Allowance","supportAllow"),
      otherAllow:gn(row,"Other Allowance","otherAllow"),
      otherAllowLabel:g(row,"Other Allow Label","otherAllowLabel"),
      epfEeRate:gn(row,"EPF Ee Rate %","EPF Employee %","epfEeRate")||11,
      epfErRate:gn(row,"EPF Er Rate %","EPF Employer %","epfErRate")||13,
      socsoCat:g(row,"SOCSO Cat","SOCSO Category","socsoCat")||"1",
      hrdfEnabled:gb(row,"HRDF","hrdfEnabled"),
      epfNo:g(row,"EPF No","epfNo"),socsoNo:g(row,"SOCSO No","socsoNo"),
      eisNo:g(row,"EIS No","eisNo"),taxNo:g(row,"Tax No","taxNo"),
      taxBranch:g(row,"Tax Branch","taxBranch"),
      phone:g(row,"Mobile","phone"),workEmail:g(row,"Work Email","workEmail"),
      personalEmail:g(row,"Personal Email","personalEmail"),
      bankName:g(row,"Bank Name","bankName"),
      bankAcc:g(row,"Bank Account","bankAcc"),bankHolder:g(row,"Account Holder","bankHolder"),
      addr1:g(row,"Address 1","addr1"),addr2:g(row,"Address 2","addr2"),
      city:g(row,"City","city"),postcode:g(row,"Postcode","postcode"),
      state:g(row,"State","state"),country:"Malaysia",
      lifeInsurance:gn(row,"Life Insurance","lifeInsurance"),
      medicalInsurance:gn(row,"Medical Insurance","medicalInsurance"),
      educationFees:gn(row,"Education Fees","educationFees"),
      childcareRelief:gn(row,"Childcare Relief","childcareRelief"),
      cp38Amount:gn(row,"CP38 Monthly RM","cp38Amount"),
      cp38Ref:g(row,"CP38 Reference","cp38Ref"),
      cp38DateFrom:g(row,"CP38 Date From","cp38DateFrom"),
      cp38DateTo:g(row,"CP38 Date To","cp38DateTo"),
      emerName:g(row,"Emer Name","emerName"),emerRel:g(row,"Emer Relation","emerRel"),
      emerPhone:g(row,"Emer Phone","emerPhone"),
      age:age,childrenDetails:[],risk:"low",
    });
  }

  function rowToAttendance(row){
    var empId=(g(row,"Employee ID","empId")||"").trim();
    var date=g(row,"Date")||"";
    if(!empId||!date) return null;
    return {
      id:"ATT-"+empId+"-"+date,empId,
      name:g(row,"Full Name","name"),date,
      scheduledIn:g(row,"Scheduled In","scheduledIn")||"08:00",
      scheduledOut:g(row,"Scheduled Out","scheduledOut")||"17:00",
      clockIn:g(row,"Clock In","clockIn","Actual Time In"),
      clockOut:g(row,"Clock Out","clockOut","Actual Time Out"),
      status:g(row,"Status")||"Present",
      lateMin:gn(row,"Late (mins)","lateMin"),
      earlyLeaveMin:gn(row,"Early Leave (mins)","earlyLeaveMin"),
      otHours:gn(row,"OT Hours","otHours"),
      absentReason:g(row,"Absent Reason","absentReason"),
      notes:g(row,"Notes","note"),
      punchSource:g(row,"Punch Source","punchSource")||"manual",
    };
  }

  function rowToLeave(row){
    var empId=(g(row,"Employee ID","empId")||"").trim();
    if(!empId) return null;
    return {
      id:g(row,"Leave ID","id")||"LV"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      empId,empNo:g(row,"Emp No","empNo")||empId,
      name:g(row,"Full Name","name"),dept:g(row,"Department","dept"),
      type:g(row,"Leave Type","type")||"Annual Leave",typeColor:"#0EA5C9",
      from:g(row,"Date From","from"),to:g(row,"Date To","to"),
      days:parseFloat(g(row,"No. of Days","days"))||1,
      status:g(row,"Status")||"Approved",
      note:g(row,"Notes / Reason","note"),
      docName:g(row,"Supporting Doc","docName"),
      submittedOn:g(row,"Submitted On","submittedOn")||new Date().toISOString().split("T")[0],
    };
  }

  function rowsToPayrollBatches(rows){
    var map={};
    rows.forEach(function(r){
      var period=(g(r,"Period")||"").trim();
      if(!period) return;
      if(!map[period]) map[period]={
        id:"PAY-"+period,period:g(r,"Period Label")||period,month:period,wd:26,
        status:g(r,"Status")||"Paid",created:new Date().toISOString().split("T")[0],by:"Import",lines:[],
      };
      var empId=(g(r,"Employee ID")||"").trim();
      if(!empId) return;
      map[period].lines.push({
        empId,empNo:g(r,"Emp No")||empId,name:g(r,"Full Name"),dept:g(r,"Department"),
        basic:gn(r,"Basic"),otHours:gn(r,"OT Hours"),otAmt:gn(r,"OT Amount"),
        incentive:gn(r,"Incentive/Commission","Commission/Incentive"),
        travelAllow:gn(r,"Travel Allow","Travel Allowance"),otherAllow:gn(r,"Other Allow","Other Allowance"),
        grossTotal:gn(r,"Gross Total"),unpaidDays:gn(r,"Unpaid Days"),unpaidAmt:gn(r,"Unpaid Deduction"),
        lateAmt:gn(r,"Late Deduction"),epfEe:gn(r,"EPF Employee"),epfEr:gn(r,"EPF Employer"),
        socsoEe:gn(r,"SOCSO Employee"),socsoEr:gn(r,"SOCSO Employer"),
        eisEe:gn(r,"EIS Employee"),eisEr:gn(r,"EIS Employer"),
        pcb:gn(r,"PCB"),cp38:gn(r,"CP38"),hrdf:gn(r,"HRDF"),netTotal:gn(r,"Net Pay"),
        lateWaived:false,adjDeduct:0,
      });
    });
    return Object.values(map).sort(function(a,b){return b.month.localeCompare(a.month);});
  }

  function rowsToOpeningBalances(rows){
    // Stored on employee object as ytd* fields
    var map={};
    rows.forEach(function(r){
      var empId=(g(r,"Employee ID")||"").trim();
      if(!empId) return;
      map[empId]={
        ytdYear:parseInt(g(r,"Go-Live Year"))||new Date().getFullYear(),
        ytdMonth:parseInt(g(r,"Go-Live Month"))||new Date().getMonth()+1,
        ytdGross:gn(r,"YTD Gross"),ytdBasic:gn(r,"YTD Basic"),ytdOt:gn(r,"YTD OT"),
        ytdAllowances:gn(r,"YTD Allowances"),ytdEpfEe:gn(r,"YTD EPF Employee"),
        ytdEpfEr:gn(r,"YTD EPF Employer"),ytdSocsoEe:gn(r,"YTD SOCSO Employee"),
        ytdSocsoEr:gn(r,"YTD SOCSO Employer"),ytdEisEe:gn(r,"YTD EIS Employee"),
        ytdEisEr:gn(r,"YTD EIS Employer"),ytdPcb:gn(r,"YTD PCB"),
        ytdCp38:gn(r,"YTD CP38"),ytdHrdf:gn(r,"YTD HRDF"),ytdNetPay:gn(r,"YTD Net Pay"),
        ytdAlTaken:gn(r,"AL Taken"),ytdSlTaken:gn(r,"SL Taken"),ytdElTaken:gn(r,"EL Taken"),
        ytdReplacementBal:gn(r,"Replacement Bal"),ytdUnpaidDays:gn(r,"Unpaid Days"),
        cp38Monthly:gn(r,"CP38 Monthly"),
      };
    });
    return map;
  }

  // ── Run import
  async function runImport(){
    setImporting(true);
    var log=[]; var stats={employees:0,attendance:0,leaves:0,batches:0,schedules:0,openingBal:0,errors:0};
    var readyFiles=files.filter(function(f){return (f.status==="ready"||f.status==="warning")&&f.rows&&f.rows.length;});

    for(var fi=0;fi<readyFiles.length;fi++){
      var f=readyFiles[fi];
      try{
        if(f.type==="employees"){
          var emps=f.rows.map(rowToEmployee).filter(Boolean);
          setEmployees(function(prev){
            var mp={}; prev.forEach(function(e){mp[e.id]=e;});
            emps.forEach(function(e){mp[e.id]=Object.assign({},mp[e.id]||{},e);});
            return Object.values(mp);
          });
          stats.employees+=emps.length;
          log.push({type:"ok",msg:"✓ "+emps.length+" employees loaded from "+f.name});
        } else if(f.type==="attendance"){
          var atts=f.rows.map(rowToAttendance).filter(Boolean);
          // Store on window for AttendanceModule to pick up
          window._importedAttendance=(window._importedAttendance||[]).concat(atts);
          stats.attendance+=atts.length;
          log.push({type:"ok",msg:"✓ "+atts.length+" attendance records loaded from "+f.name});
        } else if(f.type==="payroll"){
          var batches=rowsToPayrollBatches(f.rows);
          setGlobalBatches(function(prev){
            var mp={}; prev.forEach(function(b){mp[b.id]=b;});
            batches.forEach(function(b){mp[b.id]=b;});
            return Object.values(mp).sort(function(a,b2){return b2.month.localeCompare(a.month);});
          });
          stats.batches+=batches.length;
          log.push({type:"ok",msg:"✓ "+batches.length+" payroll periods loaded from "+f.name});
        } else if(f.type==="leave"){
          var lvs=f.rows.map(rowToLeave).filter(Boolean);
          setGlobalLeaves(function(prev){
            var existing=new Set(prev.map(function(l){return l.id;}));
            return prev.concat(lvs.filter(function(l){return !existing.has(l.id);}));
          });
          stats.leaves+=lvs.length;
          log.push({type:"ok",msg:"✓ "+lvs.length+" leave records loaded from "+f.name});
        } else if(f.type==="schedule"){
          var newWh={};
          f.rows.forEach(function(r){
            var eid=(g(r,"Employee ID")||"").trim(); if(!eid) return;
            newWh[eid]={start:g(r,"Work Start","Start Time")||"08:00",end:g(r,"Work End","End Time")||"17:00",
              brk:parseInt(g(r,"Break (mins)"))||60,flexible:gb(r,"Flexible"),ot:gb(r,"OT Eligible")||true};
          });
          setGWh(function(prev){return Object.assign({},prev,newWh);});
          stats.schedules+=Object.keys(newWh).length;
          log.push({type:"ok",msg:"✓ "+Object.keys(newWh).length+" schedules loaded from "+f.name});
        } else if(f.type==="opening"){
          var ob=rowsToOpeningBalances(f.rows);
          setEmployees(function(prev){
            return prev.map(function(e){return ob[e.id]?Object.assign({},e,ob[e.id]):e;});
          });
          stats.openingBal+=Object.keys(ob).length;
          log.push({type:"ok",msg:"✓ Opening balances for "+Object.keys(ob).length+" employees loaded from "+f.name});
        } else {
          log.push({type:"warn",msg:"⚠ Skipped '"+f.name+"' — unknown type. Change sheet type and re-import."});
        }
        setFiles(function(prev){return prev.map(function(pf){return pf.id===f.id?Object.assign({},pf,{status:"done"}):pf;});});
      } catch(e){
        stats.errors++;
        log.push({type:"error",msg:"✕ "+f.name+": "+e.message});
        setFiles(function(prev){return prev.map(function(pf){return pf.id===f.id?Object.assign({},pf,{status:"error",error:e.message}):pf;});});
      }
    }
    setImporting(false); setImportLog(log); setSummary(stats);
    setMainTab("upload");
  }

  // ── Preview component for a queued file
  function FilePreview(fp){
    var f=fp.file;
    if(!f||!f.rows||!f.rows.length) return <div style={{padding:20,color:C.ts,fontSize:12}}>No data to preview.</div>;
    var headers=Object.keys(f.rows[0]);
    var previewRows=f.rows.slice(0,20);
    var errRows=(f.issues||[]).reduce(function(acc,is,i){if(is&&is.length)acc[i]=is;return acc;},{});
    return (
      <div>
        <div style={{...S.rowSB,marginBottom:12}}>
          <div>
            <span style={{fontSize:12,fontWeight:700,color:C.tp}}>{f.name}</span>
            <span style={{marginLeft:12,fontSize:11,color:(TYPE_META[f.type]||TYPE_META.unknown).color,fontWeight:600}}>
              {(TYPE_META[f.type]||TYPE_META.unknown).label}
            </span>
          </div>
          <div style={{fontSize:11,color:C.ts}}>{f.rows.length} rows total · showing first 20</div>
        </div>
        {Object.keys(errRows).length>0&&(
          <div style={{background:C.amberL,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.amber}}>
            ⚠ {Object.keys(errRows).length} rows have validation issues (highlighted in yellow below). Fix in your Excel file and re-upload, or proceed to import anyway.
          </div>
        )}
        <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+C.border}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:600}}>
            <thead>
              <tr style={{background:C.surface}}>
                <th style={{padding:"6px 8px",borderBottom:"1px solid "+C.border,color:C.ts,fontWeight:700,textAlign:"center",width:32}}>#</th>
                {headers.map(function(h){return(
                  <th key={h} style={{padding:"6px 8px",borderBottom:"1px solid "+C.border,color:C.ts,fontWeight:700,whiteSpace:"nowrap",textAlign:"left"}}>{h}</th>
                );})}
                <th style={{padding:"6px 8px",borderBottom:"1px solid "+C.border,color:C.ts,fontWeight:700}}>Issues</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map(function(row,ri){
                var issues=f.issues&&f.issues[ri]?f.issues[ri]:[];
                var hasIssue=issues.length>0;
                return(
                  <tr key={ri} style={{background:hasIssue?C.amberL:ri%2===0?C.surface:C.card}}>
                    <td style={{padding:"5px 8px",borderBottom:"1px solid "+C.border+"55",color:C.ts,textAlign:"center",fontSize:9}}>{ri+1}</td>
                    {headers.map(function(h){return(
                      <td key={h} style={{padding:"5px 8px",borderBottom:"1px solid "+C.border+"55",color:C.tp,whiteSpace:"nowrap",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis"}}>
                        {row[h]||""}
                      </td>
                    );})}
                    <td style={{padding:"5px 8px",borderBottom:"1px solid "+C.border+"55",color:C.red,fontSize:9}}>
                      {issues.join("; ")||""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  var readyCount=files.filter(function(f){return f.status==="ready"||f.status==="warning";}).length;

  return (
    <div style={{padding:"24px 28px",height:"100%",overflowY:"auto",boxSizing:"border-box"}}>

      {/* ── Header */}
      <div style={{...S.rowSB,marginBottom:20}}>
        <div>
          <div style={{fontSize:21,fontWeight:800,color:C.tp,display:"flex",alignItems:"center",gap:10}}>
            <span style={{background:"linear-gradient(135deg,"+C.accent+","+C.purple+")",borderRadius:10,width:36,height:36,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📥</span>
            Data Import Centre
          </div>
          <div style={{fontSize:12,color:C.ts,marginTop:3,marginLeft:46}}>
            Upload employee records, attendance, payroll history, leave, and opening balances
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <a href="#" onClick={function(e){e.preventDefault();
              var a=document.createElement("a");a.href="#";
              alert("📎 Download 'HRCloud_Data_Import_Template.xlsx' from the files provided alongside this app.\n\nIt contains 8 pre-formatted sheets:\n• Employees\n• Attendance\n• Payroll History\n• Leave Records\n• Work Schedule\n• Public Holidays\n• Opening Balances\n• Dropdowns reference");
            }}
            style={{background:C.accentL,color:C.accent,borderRadius:10,padding:"9px 18px",fontSize:12,
              fontWeight:700,cursor:"pointer",textDecoration:"none",border:"1.5px solid "+C.accent+"55"}}>
            📋 Template Guide
          </a>
          {readyCount>0&&(
            <button onClick={runImport} disabled={importing}
              style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",color:"#fff",
                border:"none",borderRadius:10,padding:"9px 22px",fontSize:12,fontWeight:700,
                cursor:importing?"not-allowed":"pointer",fontFamily:"inherit",
                boxShadow:"0 4px 16px "+C.accent+"44",opacity:importing?0.7:1}}>
              {importing?"⏳ Importing…":"⬆ Import "+readyCount+" file(s)"}
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs */}
      <div style={{display:"flex",gap:2,marginBottom:20,background:C.surface,borderRadius:10,padding:4,width:"fit-content",border:"1px solid "+C.border}}>
        {[["upload","📂 Upload"],["preview","🔍 Preview"+(selFile!=null?" ·"+files[selFile]&&files[selFile].rows.length:"")],["guide","📖 Guide"]].map(function(t,ti){
          return(
            <button key={t[0]} onClick={function(){setMainTab(t[0]);}}
              style={{background:mainTab===t[0]?C.card:"transparent",color:mainTab===t[0]?C.accent:C.ts,
                border:mainTab===t[0]?"1px solid "+C.border+"88":"1px solid transparent",
                borderRadius:8,padding:"7px 16px",fontSize:11,fontWeight:mainTab===t[0]?700:400,
                cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              {t[1]}
            </button>
          );
        })}
      </div>

      {/* ── UPLOAD TAB */}
      {mainTab==="upload"&&(
        <div>
          {/* Drop zone */}
          <div
            onDragOver={function(e){e.preventDefault();setDragOver(true);}}
            onDragLeave={function(){setDragOver(false);}}
            onDrop={function(e){e.preventDefault();setDragOver(false);processFiles(e.dataTransfer.files);}}
            onClick={function(){document.getElementById("_hrImportInput").click();}}
            style={{border:"2.5px dashed "+(dragOver?C.accent:C.border),borderRadius:16,
              padding:"36px 24px",textAlign:"center",background:dragOver?C.accentL:C.surface,
              transition:"all .2s",marginBottom:20,cursor:"pointer",
              boxShadow:dragOver?"0 0 0 4px "+C.accent+"22":"none"}}>
            <div style={{fontSize:40,marginBottom:8}}>{dragOver?"🎯":"📂"}</div>
            <div style={{fontSize:16,fontWeight:700,color:C.tp,marginBottom:6}}>
              {dragOver?"Drop your files here…":"Drag & drop files, or click to browse"}
            </div>
            <div style={{fontSize:11,color:C.ts,marginBottom:4}}>
              Accepts <strong>.xlsx</strong> (all sheets auto-detected) and <strong>.csv</strong> (one sheet per file)
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginTop:10}}>
              {["👤 Employees","⏰ Attendance","💰 Payroll","🌴 Leave","📅 Schedule","💳 Opening Balances"].map(function(l){
                return <span key={l} style={{background:C.card,border:"1px solid "+C.border,borderRadius:20,
                  padding:"3px 10px",fontSize:10,color:C.ts}}>{l}</span>;
              })}
            </div>
            <input id="_hrImportInput" type="file" multiple accept=".csv,.xlsx,.xls"
              style={{display:"none"}} onChange={function(e){processFiles(e.target.files);e.target.value="";}}/>
          </div>

          {/* SheetJS hint */}
          {!window.XLSX&&files.some(function(f){return f.name.match(/\.(xlsx|xls)$/i)&&f.status==="warning";})&&(
            <div style={{background:C.amberL,border:"1px solid "+C.amber+"44",borderRadius:10,
              padding:"10px 16px",fontSize:11,color:C.amber,marginBottom:16}}>
              ℹ <strong>Tip for .xlsx files:</strong> Export each sheet as CSV from Excel (File → Save As → CSV) for the most reliable upload.
              Name the file to match the sheet type, e.g. <em>employees.csv</em>, <em>attendance.csv</em>.
            </div>
          )}

          {/* Queued files */}
          {files.length>0&&(
            <div>
              <div style={{...S.rowSB,marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:C.tp}}>
                  {files.length} file(s) queued
                  {readyCount>0&&<span style={{marginLeft:8,color:C.accent,fontSize:11}}>{readyCount} ready to import</span>}
                </div>
                <button onClick={function(){if(confirmClear){setFiles([]);setSummary(null);setImportLog([]);setSelFile(null);setConfirmClear(false);}else setConfirmClear(true);}}
                  style={{background:confirmClear?C.redL:C.surface,border:"1px solid "+(confirmClear?C.red:C.border),
                    color:confirmClear?C.red:C.ts,borderRadius:8,padding:"5px 14px",fontSize:11,
                    cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
                  {confirmClear?"Confirm clear all":"Clear all"}
                </button>
              </div>

              {files.map(function(f,idx){
                var meta=TYPE_META[f.type]||TYPE_META.unknown;
                var errCount=f.issues?f.issues.filter(function(is){return is&&is.length>0;}).length:0;
                return(
                  <div key={f.id} style={{background:C.card,border:"1px solid "+(f.status==="error"?C.red:f.status==="warning"?C.amber:f.status==="done"?C.green:C.border),
                    borderRadius:12,padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12,
                    transition:"border-color .2s"}}>
                    {/* Status dot */}
                    <div style={{width:9,height:9,borderRadius:"50%",flexShrink:0,background:
                      f.status==="done"?C.green:f.status==="error"?C.red:f.status==="warning"?C.amber:C.accent}}/>

                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.tp,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                      <div style={{fontSize:10,color:C.ts,marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                        <span style={{color:meta.color,fontWeight:600,background:meta.bg,borderRadius:10,padding:"1px 8px"}}>{meta.label}</span>
                        {f.rows&&f.rows.length>0&&<span>{f.rows.length} rows</span>}
                        {errCount>0&&<span style={{color:C.amber}}>⚠ {errCount} row issues</span>}
                        {f.status==="done"&&<span style={{color:C.green,fontWeight:600}}>✓ Imported</span>}
                        {f.status==="error"&&<span style={{color:C.red}}>{f.error}</span>}
                        {f.status==="warning"&&f.warning&&<span style={{color:C.amber}}>{f.warning}</span>}
                      </div>
                    </div>

                    {/* Preview button */}
                    {f.rows&&f.rows.length>0&&(
                      <button onClick={function(){setSelFile(idx);setMainTab("preview");}}
                        style={{background:C.surface,border:"1px solid "+C.border,color:C.ts,borderRadius:8,
                          padding:"4px 12px",fontSize:10,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                        🔍 Preview
                      </button>
                    )}

                    {/* Type override */}
                    {f.status!=="done"&&(
                      <select value={f.type}
                        onChange={function(e){var v=e.target.value;setFiles(function(prev){return prev.map(function(pf){return pf.id===f.id?Object.assign({},pf,{type:v}):pf;});});}}
                        style={{border:"1px solid "+C.border,borderRadius:8,padding:"4px 8px",fontSize:10,
                          background:C.surface,color:C.tp,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                        {Object.entries(TYPE_META).map(function(e){return <option key={e[0]} value={e[0]}>{e[1].label}</option>;})}
                      </select>
                    )}

                    {/* Remove */}
                    <button onClick={function(){setFiles(function(prev){return prev.filter(function(pf){return pf.id!==f.id;});});if(selFile===idx)setSelFile(null);}}
                      style={{background:"none",border:"none",color:C.ts,cursor:"pointer",fontSize:16,padding:"0 2px",lineHeight:1,flexShrink:0}}>✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Import result summary */}
          {summary&&(
            <div style={{marginTop:20}}>
              <div style={{background:summary.errors>0?C.amberL:C.greenL,border:"1px solid "+(summary.errors>0?C.amber:C.green)+"44",
                borderRadius:14,padding:"16px 20px"}}>
                <div style={{fontSize:14,fontWeight:800,color:summary.errors>0?C.amber:C.green,marginBottom:14}}>
                  {summary.errors>0?"⚠ Import completed with errors":"✅ Import Complete"}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                  {[["👤 Employees",summary.employees,C.accent],
                    ["⏰ Attendance",summary.attendance,C.green],
                    ["💰 Payroll Periods",summary.batches,C.green],
                    ["🌴 Leave Records",summary.leaves,C.purple],
                    ["📅 Schedules",summary.schedules,C.amber],
                    ["💳 Opening Balances",summary.openingBal,C.amber]].map(function(item,i){
                    return(
                      <div key={i} style={{background:C.card,borderRadius:10,padding:"10px 14px",textAlign:"center",border:"1px solid "+C.border}}>
                        <div style={{fontSize:11,color:C.ts,marginBottom:4}}>{item[0]}</div>
                        <div style={{fontSize:20,fontWeight:900,color:item[1]}}>{item[2]}</div>
                      </div>
                    );
                  })}
                </div>
                {importLog.length>0&&(
                  <div style={{background:C.surface,borderRadius:8,padding:"10px 14px",maxHeight:160,overflowY:"auto"}}>
                    {importLog.map(function(lg,i){
                      return <div key={i} style={{fontSize:10,color:lg.type==="ok"?C.green:lg.type==="error"?C.red:C.amber,marginBottom:3,fontFamily:"monospace"}}>{lg.msg}</div>;
                    })}
                  </div>
                )}
                <div style={{fontSize:11,color:C.ts,marginTop:12}}>
                  ✔ Data loaded into session memory. <strong>Navigate to each module to verify.</strong>
                  {" "}Connect the backend API in Settings to persist data across sessions.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PREVIEW TAB */}
      {mainTab==="preview"&&(
        <div>
          {files.length===0&&<div style={{color:C.ts,fontSize:12,padding:20}}>No files uploaded yet. Go to Upload tab first.</div>}
          {files.length>0&&(
            <div>
              <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
                {files.filter(function(f){return f.rows&&f.rows.length;}).map(function(f,idx){
                  return(
                    <button key={f.id} onClick={function(){setSelFile(idx);}}
                      style={{background:selFile===idx?C.accent:C.surface,color:selFile===idx?"#fff":C.tp,
                        border:"1px solid "+(selFile===idx?C.accent:C.border),borderRadius:20,
                        padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:selFile===idx?700:400}}>
                      {f.name.length>28?f.name.slice(0,25)+"…":f.name}
                      {f.issues&&f.issues.filter(function(is){return is&&is.length;}).length>0&&
                        <span style={{marginLeft:4,color:selFile===idx?"#FFD700":C.amber}}>⚠</span>}
                    </button>
                  );
                })}
              </div>
              {selFile!=null&&files[selFile]&&<FilePreview file={files[selFile]}/>}
              {selFile==null&&<div style={{color:C.ts,fontSize:12}}>Select a file above to preview its contents.</div>}
            </div>
          )}
        </div>
      )}

      {/* ── GUIDE TAB */}
      {mainTab==="guide"&&(
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.tp,marginBottom:4}}>📋 How to use the Import Template</div>
          <div style={{fontSize:11,color:C.ts,marginBottom:18}}>
            Download <strong>HRCloud_Data_Import_Template.xlsx</strong> — fill each sheet, then upload here.
          </div>

          {[{icon:"👤",label:"Employees",color:C.accent,bg:C.accentL,
              required:["Employee ID","Full Name","Gender","Date of Birth","NRIC / Passport","Department","Role","Employment Type","Join Date","Status","Basic Salary"],
              tip:"Fill this sheet first. Employee ID is the master key across all other sheets. Login password = last 6 digits of NRIC."},
            {icon:"⏰",label:"Attendance",color:C.green,bg:C.greenL,
              required:["Employee ID","Date","Clock In","Status"],
              tip:"One row per employee per working day. Date format: YYYY-MM-DD. Time format: HH:MM (24-hour). Used for late/absent deductions in payroll."},
            {icon:"💰",label:"Payroll History",color:"#1D6F42",bg:C.greenL,
              required:["Period","Employee ID","Basic","Gross Total","EPF Employee","EPF Employer","SOCSO Employee","SOCSO Employer","EIS Employee","EIS Employer","PCB","Net Pay"],
              tip:"Period format: YYYY-MM (e.g. 2025-01). One row per employee per month. Import historical months for YTD reports and EA Form."},
            {icon:"🌴",label:"Leave Records",color:C.purple,bg:C.purpleL,
              required:["Employee ID","Leave Type","Date From","Date To","No. of Days","Status"],
              tip:"Leave Types: Annual Leave / Sick Leave / Emergency Leave / Maternity Leave / Paternity Leave / Half Day / Replacement Leave / Unpaid Leave."},
            {icon:"📅",label:"Work Schedule",color:C.amber,bg:C.amberL,
              required:["Employee ID","Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
              tip:"Shift values: morning / afternoon / split / off. Optionally override with Work Start and Work End times."},
            {icon:"💳",label:"Opening Balances",color:C.amber,bg:C.amberL,
              required:["Employee ID","Go-Live Year","Go-Live Month","YTD Gross","YTD EPF Employee","YTD EPF Employer","YTD SOCSO Employee","YTD SOCSO Employer","YTD EIS Employee","YTD EIS Employer","YTD PCB","YTD Net Pay"],
              tip:"Required for staff employed before go-live. Enter YTD figures for Jan through the month before go-live. E.g. go-live = June 2025 → enter Jan–May totals."},
          ].map(function(sheet,si){
            return(
              <div key={si} style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,
                padding:"14px 18px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{fontSize:20}}>{sheet.icon}</span>
                  <span style={{fontWeight:700,color:sheet.color,fontSize:13}}>{sheet.label}</span>
                </div>
                <div style={{fontSize:10,fontWeight:700,color:C.ts,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Required columns:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                  {sheet.required.map(function(r){
                    return <span key={r} style={{background:sheet.bg,color:sheet.color,borderRadius:6,
                      padding:"2px 8px",fontSize:10,fontWeight:600}}>{r}</span>;
                  })}
                </div>
                <div style={{fontSize:11,color:C.ts,fontStyle:"italic"}}>{sheet.tip}</div>
              </div>
            );
          })}

          <div style={{background:C.amberL,border:"1px solid "+C.amber+"44",borderRadius:12,padding:"14px 18px"}}>
            <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:8}}>⚠ Important rules</div>
            {["All dates: YYYY-MM-DD format (e.g. 2025-06-15). Excel may auto-format — double check.",
              "Money values: no commas, decimals allowed (e.g. 5800.00 not 5,800).",
              "Employee ID must be identical across all sheets — it is the join key.",
              "Delete ALL sample rows (light blue/tinted rows) before uploading.",
              "Column headers must not be renamed or deleted.",
              "For .xlsx files with multiple sheets: you can upload the whole file — each sheet is auto-detected.",
              "After import, check each module (Employees, Payroll, Leave) to confirm data looks correct.",
              "Opening Balances must be imported AFTER Employees — it updates the employee records.",
            ].map(function(note,i){
              return <div key={i} style={{fontSize:11,color:C.amber,display:"flex",gap:8,marginBottom:5}}>
                <span style={{color:C.amber,flexShrink:0}}>•</span>{note}
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function SetupModule(props) {
  var companies = props.companies || [];
  var setCompanies = props.setCompanies || function(){};
  var activeCompany = props.activeCompany;
  var setActiveCompany = props.setActiveCompany || function(){};

  var [tab, setTab] = useState("companies");
  var [showForm, setShowForm] = useState(false);
  var [form, setForm] = useState({});
  var [editId, setEditId] = useState(null);

  var openNew = function() { setForm({}); setEditId(null); setShowForm(true); };
  var openEdit = function(co) { setForm(Object.assign({}, co)); setEditId(co.id); setShowForm(true); };
  var save = function() {
    if (editId) {
      setCompanies(function(prev) { return prev.map(function(c) { return c.id===editId?Object.assign({},form):c; }); });
    } else {
      var newCo = Object.assign({}, form, {id:"CO"+(companies.length+1).toString().padStart(3,"0"),status:"Active"});
      setCompanies(function(prev) { return prev.concat([newCo]); });
    }
    setShowForm(false);
  };

  var setF = function(k, v) { setForm(function(f) { var u = Object.assign({}, f); u[k] = v; return u; }); };

  return (
    <div>
      <SectionHead title="System Setup" sub="Multi-company management and statutory registration"
        action={tab==="companies"?<Btn c={C.green} onClick={openNew}>+ New Company</Btn>:null} />

      {showForm && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.45)",zIndex:1000,
          display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"40px 20px"}}>
          <div style={{background:C.card,borderRadius:18,width:"100%",maxWidth:680,padding:32,position:"relative"}}>
            <div style={{color:C.tp,fontWeight:800,fontSize:18,marginBottom:20}}>{editId?"Edit Company":"New Company"}</div>
            <div style={S.g2s}>
              <div><FLabel>Company Name</FLabel><FInput value={form["name"]||""} onChange={function(e){setF("name",e.target.value);}} placeholder="e.g. TechCorp Sdn. Bhd." /></div>
              <div><FLabel>Trade Name</FLabel><FInput value={form["tradeName"]||""} onChange={function(e){setF("tradeName",e.target.value);}} /></div>
              <div><FLabel>SSM Number</FLabel><FInput value={form["ssmNo"]||""} onChange={function(e){setF("ssmNo",e.target.value);}} /></div>
              <div><FLabel>LHDN Number</FLabel><FInput value={form["lhdnNo"]||""} onChange={function(e){setF("lhdnNo",e.target.value);}} /></div>
              <div><FLabel>EPF Employer No.</FLabel><FInput value={form["epfNo"]||""} onChange={function(e){setF("epfNo",e.target.value);}} /></div>
              <div><FLabel>SOCSO Employer No.</FLabel><FInput value={form["socsoNo"]||""} onChange={function(e){setF("socsoNo",e.target.value);}} /></div>
              <div><FLabel>Contact Phone</FLabel><FInput value={form["phone"]||""} onChange={function(e){setF("phone",e.target.value);}} /></div>
              <div><FLabel>Contact Email</FLabel><FInput value={form["email"]||""} onChange={function(e){setF("email",e.target.value);}} /></div>
              <div style={{gridColumn:"1/-1"}}><FLabel>Address</FLabel><FInput value={form["addr1"]||""} onChange={function(e){setF("addr1",e.target.value);}} placeholder="Address line 1" /></div>
              <div><FLabel>City</FLabel><FInput value={form["city"]||""} onChange={function(e){setF("city",e.target.value);}} /></div>
              <div><FLabel>State</FLabel><FInput value={form["state"]||""} onChange={function(e){setF("state",e.target.value);}} /></div>
            </div>
            <div style={{marginTop:20,display:"flex",justifyContent:"flex-end",gap:10}}>
              <Btn c={C.ts} onClick={function(){setShowForm(false);}}>Cancel</Btn>
              <Btn c={C.green} onClick={save}>Save</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["companies","Companies"],["general","General Settings"]].map(function(t) {
          return (
            <button key={t[0]} onClick={function(){setTab(t[0]);}} style={{
              background:tab===t[0]?C.accentL:"transparent",
              color:tab===t[0]?C.accent:C.ts,
              border:"1.5px solid "+(tab===t[0]?C.accent+"66":C.border),
              borderRadius:8,padding:"7px 18px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            }}>{t[1]}</button>          );
        })}
      </div>

      {tab === "companies" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {companies.map(function(co) {
            var isActive = co.id === activeCompany;
            return (
              <Card key={co.id} style={{borderLeft:"4px solid "+(isActive?C.accent:C.border)}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{color:C.tp,fontWeight:800,fontSize:15}}>{co.name}</div>
                    <div style={{color:C.ts,fontSize:12,marginTop:2}}>{co.tradeName} - {co.id}</div>
                  </div>
                  <div style={S.rowG6}>
                    {isActive && <Chip text="Active Company" c={C.accent} />}
                    <StatusChip s={co.status||"Active"} />
                  </div>
                </div>
                {[["SSM",co.ssmNo],["LHDN",co.lhdnNo],["EPF",co.epfNo],["Address",co.addr1+", "+co.city]].map(function(item) {
                  return (
                    <div key={item[0]} style={{display:"flex",gap:8,marginBottom:4}}>
                      <span style={{color:C.ts,fontSize:11,minWidth:48}}>{item[0]}:</span>
                      <span style={{color:C.tp,fontSize:11,fontWeight:600}}>{item[1]||"--"}</span>
                    </div>                  );
                })}
                <div style={{marginTop:12,display:"flex",gap:8}}>
                  {!isActive && <Btn sm c={C.green} onClick={function(){setActiveCompany(co.id);}}>Set Active</Btn>}
                  <Btn sm c={C.accent} onClick={function(){openEdit(co);}}>Edit</Btn>
                </div>
              </Card>            );
          })}
        </div>
      )}

      {tab === "general" && (
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>General Settings</div>
          {[["Payroll Cycle","Monthly"],["Pay Day","Last Working Day"],["Currency","MYR - Malaysian Ringgit"],
            ["Default Working Days","26 days/month"],["Overtime Rate","1.5x (Regular), 2x (Rest Day), 3x (Public Holiday)"],
            ["Minimum Wage","RM 1,700/month (effective Feb 2023)"]].map(function(item,i) {
            return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid "+C.border+"44"}}>
                <span style={S.ts13}>{item[0]}</span>
                <span style={{color:C.tp,fontWeight:600,fontSize:13}}>{item[1]}</span>
              </div>            );
          })}
        </Card>
      )}
    </div>  );
}

// -- MOBILE PREVIEW MODULE
function MobilePreview(props) {
  var employees      = props.employees      || [];
  var globalLeaves   = props.globalLeaves   || [];
  var setGlobalLeaves= props.setGlobalLeaves|| function(){};
  var globalBatches  = props.globalBatches  || [];
  var payrollConfig  = props.payrollConfig  || INIT_PAYROLL_CONFIG;
  var leaveConfig    = props.leaveConfig    || {leaveTypes:[], publicHolidays:[], entitlements:[], policy:{}};
  var companies      = props.companies      || [];
  var activeCompany  = props.activeCompany  || "";
  var co             = companies.find(function(c){return c.id===activeCompany;})||companies[0]||{};
  var gSched         = props.gSched         || {};
  var gWh            = props.gWh            || {};
  var gUnified       = props.gUnified       || {};
  var gSchedMode     = props.gSchedMode     || "off";

  // Simulated "logged-in" employee — first employee (E001 Ahmad Farid)
  var me = employees[0] || {};

  // Derive payroll row for this employee from latest Paid/Confirmed batch
  var latestBatch = globalBatches.find(function(b){return b.status==="Paid"||b.status==="Confirmed";}) || globalBatches[0];
  var batchOv = (latestBatch && latestBatch.overrides) ? latestBatch.overrides : {};
  var meOv = batchOv[me.id] || {};
  var ss = gSched[me.id] || null;
  var myRow = me.id ? computeRow(me, latestBatch?latestBatch.wd:26, meOv, ss, payrollConfig) : {};

  // My leaves
  var myLeaves = globalLeaves.filter(function(l){return l.empId===me.id;});
  var pendingLeaves = myLeaves.filter(function(l){return l.status==="Pending";});

  // Leave balances — count approved leaves by type this year
  var leaveTypes = leaveConfig.leaveTypes && leaveConfig.leaveTypes.length
    ? leaveConfig.leaveTypes
    : [{name:"Annual Leave",maxDays:16},{name:"Sick Leave",maxDays:14},{name:"Emergency Leave",maxDays:3}];
  function usedDays(typeName) {
    return myLeaves.filter(function(l){return l.type===typeName&&l.status==="Approved";})
      .reduce(function(s,l){return s+(l.days||0);},0);
  }
  function balanceDays(lt) {
    var max = lt.maxDays||lt.days||14;
    return Math.max(0, max - usedDays(lt.name));
  }

  // Attendance — clock in/out state (in-memory for session)
  var _clockedIn = useState(false); var clockedIn=_clockedIn[0]; var setClockedIn=_clockedIn[1];
  var _clockTime = useState(null);  var clockTime=_clockTime[0]; var setClockTime=_clockTime[1];
  var _punchHistory = useState([]); var punchHistory=_punchHistory[0]; var setPunchHistory=_punchHistory[1];
  var _mobileTab = useState("home"); var mobileTab=_mobileTab[0]; var setMobileTab=_mobileTab[1];
  var _showLeaveForm = useState(false); var showLeaveForm=_showLeaveForm[0]; var setShowLeaveForm=_showLeaveForm[1];
  var _leaveForm = useState({type:leaveTypes[0]?leaveTypes[0].name:"Annual Leave",from:"",to:"",note:""});
  var leaveForm=_leaveForm[0]; var setLeaveForm=_leaveForm[1];
  var _toastMsg = useState(null); var toastMsg=_toastMsg[0]; var setToastMsg=_toastMsg[1];
  var _tick = useState(new Date()); var tick=_tick[0]; var setTick=_tick[1];

  React.useEffect(function(){var t=setInterval(function(){setTick(new Date());},1000);return function(){clearInterval(t);};},[]);
  React.useEffect(function(){
    if(toastMsg){var t=setTimeout(function(){setToastMsg(null);},2800);return function(){clearTimeout(t);};}
  },[toastMsg]);

  function fmt2(n){return String(n).padStart(2,"0");}
  var nowTimeStr = fmt2(tick.getHours())+":"+fmt2(tick.getMinutes())+":"+fmt2(tick.getSeconds());
  var nowDateStr = tick.toLocaleDateString("en-MY",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  var greet = tick.getHours()<12?"Good morning":tick.getHours()<17?"Good afternoon":"Good evening";

  function handleClock(){
    if(!clockedIn){
      var t=fmt2(tick.getHours())+":"+fmt2(tick.getMinutes());
      setClockedIn(true); setClockTime(t);
      setPunchHistory(function(h){return [{type:"IN",time:t,date:tick.toLocaleDateString("en-MY")}].concat(h);});
      setToastMsg("✅ Clocked IN at "+t);
    } else {
      var t2=fmt2(tick.getHours())+":"+fmt2(tick.getMinutes());
      setClockedIn(false);
      setPunchHistory(function(h){return [{type:"OUT",time:t2,date:tick.toLocaleDateString("en-MY")}].concat(h);});
      setToastMsg("👋 Clocked OUT at "+t2);
      setClockTime(null);
    }
  }

  function submitLeave(){
    if(!leaveForm.from||!leaveForm.to){setToastMsg("⚠️ Please fill in dates");return;}
    var from=new Date(leaveForm.from), to=new Date(leaveForm.to);
    var days=Math.max(1,Math.round((to-from)/(1000*60*60*24))+1);
    var lt = leaveConfig.leaveTypes&&leaveConfig.leaveTypes.find(function(x){return x.name===leaveForm.type;});
    var col = lt?lt.color:"#0EA5C9";
    var newLeave = {
      id:"L"+Date.now(),empId:me.id,empNo:me.empNo,name:me.name,dept:me.dept,
      type:leaveForm.type,typeColor:col,
      from:leaveForm.from,to:leaveForm.to,days:days,
      status:"Pending",note:leaveForm.note,docName:"",submittedOn:new Date().toISOString().split("T")[0]
    };
    setGlobalLeaves(function(prev){return [newLeave].concat(prev);});
    setShowLeaveForm(false);
    setLeaveForm({type:leaveTypes[0]?leaveTypes[0].name:"Annual Leave",from:"",to:"",note:""});
    setToastMsg("✅ Leave submitted — "+days+" day(s)");
  }

  var fmt = function(n){return (parseFloat(n)||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2});};

  // Phone screen content per tab
  var screenBg = "#F8FAFF";

  return (
    <div style={{display:"flex",gap:32,alignItems:"flex-start",justifyContent:"center",flexWrap:"wrap",padding:"0 0 40px"}}>

      {/* ── PHONE MOCKUP ── */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{fontSize:11,color:C.ts,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>
          📱 HRCloud Mobile · {co.name||"Company"}
        </div>

        {/* Phone shell */}
        <div style={{width:290,background:"#0a0a14",borderRadius:44,padding:"16px 10px 20px",
          boxShadow:"0 40px 80px rgba(0,0,0,.4),0 0 0 1px #1e1e2e,inset 0 0 0 1px #2a2a3e",position:"relative"}}>
          {/* Notch */}
          <div style={{width:70,height:18,background:"#0a0a14",borderRadius:9,margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#1a1a2e"}}/>
            <div style={{width:3,height:3,borderRadius:"50%",background:"#1a1a2e"}}/>
          </div>

          {/* Screen */}
          <div style={{borderRadius:28,overflow:"hidden",height:540,background:screenBg,display:"flex",flexDirection:"column",position:"relative"}}>

            {/* Toast */}
            {toastMsg&&(
              <div style={{position:"absolute",top:8,left:8,right:8,zIndex:99,background:C.tp,color:"#fff",
                borderRadius:10,padding:"8px 12px",fontSize:10,fontWeight:600,textAlign:"center",
                boxShadow:"0 4px 16px rgba(0,0,0,.3)"}}>
                {toastMsg}
              </div>
            )}

            {/* ── HOME TAB ── */}
            {mobileTab==="home"&&(
              <div style={{flex:1,overflowY:"auto"}}>
                {/* Header */}
                <div style={{background:"linear-gradient(135deg,#4F6EF7,#3451D1)",padding:"20px 16px 16px",color:"#fff"}}>
                  <div style={{fontSize:9,opacity:.7,marginBottom:2,letterSpacing:.5}}>HRCloud Mobile · {co.name||"TechCorp"}</div>
                  <div style={{fontSize:15,fontWeight:800,marginBottom:1}}>{greet}, {me.preferredName||me.name||"Employee"}!</div>
                  <div style={{fontSize:9,opacity:.7}}>{nowDateStr}</div>
                  <div style={{marginTop:12,background:"rgba(255,255,255,.15)",borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:9,opacity:.7}}>Live Time</div>
                      <div style={{fontSize:18,fontWeight:800,fontFamily:"monospace",letterSpacing:2}}>{nowTimeStr}</div>
                    </div>
                    <button onClick={handleClock} style={{
                      background:clockedIn?"#FF3B5C":"#00E5A0",color:"#fff",border:"none",
                      borderRadius:20,padding:"7px 14px",fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:.5}}>
                      {clockedIn?"CLOCK OUT":"CLOCK IN"}
                    </button>
                  </div>
                  {clockedIn&&clockTime&&(
                    <div style={{marginTop:6,fontSize:9,opacity:.8,textAlign:"right"}}>
                      ● Clocked in since {clockTime}
                    </div>
                  )}
                </div>

                <div style={{padding:"12px 12px 80px"}}>
                  {/* Quick tiles */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    {[
                      {label:"My Payslip",  icon:<DollarSign size={18}/>, bg:C.accentL, col:C.accent, tab:"payslip"},
                      {label:"Apply Leave", icon:<Umbrella size={18}/>,   bg:C.amberL,  col:C.amber,  tab:"leave"},
                      {label:"Attendance",  icon:<Clock size={18}/>,      bg:C.greenL,  col:C.green,  tab:"attendance"},
                      {label:"Schedule",    icon:<Calendar size={18}/>,   bg:C.accentL, col:C.accent, tab:"schedule"},
                    ].map(function(tile){return(
                      <div key={tile.label} onClick={function(){setMobileTab(tile.tab);}}
                        style={{background:tile.bg,borderRadius:10,padding:"12px 10px",textAlign:"center",cursor:"pointer"}}>
                        <div style={{color:tile.col,marginBottom:4,display:"flex",justifyContent:"center"}}>{tile.icon}</div>
                        <div style={{color:tile.col,fontSize:10,fontWeight:700}}>{tile.label}</div>
                      </div>
                    );})}
                  </div>

                  {/* Latest Payslip */}
                  <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                    <div style={{color:C.ts,fontSize:9,fontWeight:700,marginBottom:6,letterSpacing:.5}}>LATEST PAYSLIP</div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:C.tp}}>{latestBatch?latestBatch.period:"—"}</div>
                        <div style={{fontSize:10,color:C.green,fontWeight:600,marginTop:2}}>
                          Net: RM {myRow.netTotal?fmt(myRow.netTotal):"—"}
                        </div>
                      </div>
                      <StatusChip s={latestBatch?latestBatch.status:"—"} />
                    </div>
                  </div>

                  {/* Leave balance */}
                  <div style={{background:C.accentL,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                    <div style={{color:C.ts,fontSize:9,fontWeight:700,marginBottom:8,letterSpacing:.5}}>LEAVE BALANCE</div>
                    <div style={{display:"flex",gap:6,justifyContent:"space-between"}}>
                      {leaveTypes.slice(0,3).map(function(lt){return(
                        <div key={lt.name} style={{textAlign:"center",flex:1}}>
                          <div style={{color:C.accent,fontWeight:800,fontSize:16}}>{balanceDays(lt)}</div>
                          <div style={{color:C.ts,fontSize:8,marginTop:1}}>{lt.name.replace(" Leave","")}</div>
                        </div>
                      );})}
                    </div>
                  </div>

                  {/* Pending leaves */}
                  {pendingLeaves.length>0&&(
                    <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:10,padding:"8px 12px"}}>
                      <div style={{color:C.amber,fontSize:9,fontWeight:700,marginBottom:4}}>⏳ PENDING APPROVAL ({pendingLeaves.length})</div>
                      {pendingLeaves.slice(0,2).map(function(l){return(
                        <div key={l.id} style={{fontSize:9,color:"#92400E",marginBottom:2}}>
                          {l.type} · {l.from} – {l.to} · {l.days}d
                        </div>
                      );})}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PAYSLIP TAB ── */}
            {mobileTab==="payslip"&&(
              <div style={{flex:1,overflowY:"auto"}}>
                <div style={{background:"linear-gradient(135deg,#4F6EF7,#3451D1)",padding:"16px",color:"#fff"}}>
                  <div style={{fontSize:9,opacity:.7,marginBottom:4}}>MY PAYSLIP</div>
                  <div style={{fontSize:14,fontWeight:800}}>{latestBatch?latestBatch.period:"—"}</div>
                  <div style={{fontSize:9,opacity:.7,marginTop:2}}>{co.name||"TechCorp Sdn. Bhd."}</div>
                </div>
                <div style={{padding:"12px 12px 80px"}}>
                  {/* Employee info */}
                  <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.tp,marginBottom:4}}>{me.name||"—"}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:9,color:C.ts}}>
                      <div>Dept: <strong>{me.dept||"—"}</strong></div>
                      <div>Position: <strong>{me.position||"—"}</strong></div>
                      <div>Emp No: <strong>{me.empNo||"—"}</strong></div>
                      <div>Bank: <strong>{me.bankName||"—"}</strong></div>
                    </div>
                  </div>
                  {/* Earnings */}
                  <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:700,color:C.ts,marginBottom:6,letterSpacing:.5}}>EARNINGS</div>
                    {[
                      ["Basic Salary","basic"],["OT Amount","otAmt"],["Travel Allowance","travel"],
                      ["Other Allowance","other"],["Incentive","incentive"],
                    ].filter(function(r){return myRow[r[1]]>0;}).map(function(r){return(
                      <div key={r[0]} style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                        <span style={{color:C.ts}}>{r[0]}</span>
                        <span style={{color:C.tp,fontWeight:600}}>RM {fmt(myRow[r[1]])}</span>
                      </div>
                    );})}
                    <div style={{borderTop:"1.5px solid "+C.border,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700}}>
                      <span>Gross Pay</span><span style={{color:C.green}}>RM {fmt(myRow.grossTotal)}</span>
                    </div>
                  </div>
                  {/* Deductions */}
                  <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:700,color:C.ts,marginBottom:6,letterSpacing:.5}}>DEDUCTIONS</div>
                    {[
                      ["EPF (EE 11%)","epfEe"],["SOCSO","socsoEe"],["EIS","eisEe"],
                      ["PCB/MTD Tax","pcb"],["Absent Deduction","unpaidAmt"],["Late Deduction","lateAmt"],
                    ].filter(function(r){return myRow[r[1]]>0;}).map(function(r){return(
                      <div key={r[0]} style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                        <span style={{color:C.ts}}>{r[0]}</span>
                        <span style={{color:C.red,fontWeight:600}}>-RM {fmt(myRow[r[1]])}</span>
                      </div>
                    );})}
                    <div style={{borderTop:"1.5px solid "+C.border,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700}}>
                      <span>Total Deductions</span><span style={{color:C.red}}>-RM {fmt(myRow.totalDeduct)}</span>
                    </div>
                  </div>
                  {/* Net */}
                  <div style={{background:"linear-gradient(135deg,"+C.green+",#047857)",borderRadius:10,padding:"12px",color:"#fff",textAlign:"center"}}>
                    <div style={{fontSize:9,opacity:.8,marginBottom:4}}>NET PAY</div>
                    <div style={{fontSize:22,fontWeight:800}}>RM {fmt(myRow.netTotal)}</div>
                    <div style={{fontSize:9,opacity:.7,marginTop:2}}>
                      {me.bankName||"Bank"} · {me.bankAcc||"—"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── LEAVE TAB ── */}
            {mobileTab==="leave"&&(
              <div style={{flex:1,overflowY:"auto"}}>
                <div style={{background:"linear-gradient(135deg,#D97706,#B45309)",padding:"16px",color:"#fff"}}>
                  <div style={{fontSize:9,opacity:.7,marginBottom:4}}>MY LEAVE</div>
                  <div style={{fontSize:14,fontWeight:800}}>Leave Management</div>
                </div>
                <div style={{padding:"12px 12px 80px"}}>
                  {/* Balance cards */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:12}}>
                    {leaveTypes.slice(0,3).map(function(lt){return(
                      <div key={lt.name} style={{background:"#fff",border:"1px solid "+C.border,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                        <div style={{fontSize:18,fontWeight:800,color:C.accent}}>{balanceDays(lt)}</div>
                        <div style={{fontSize:7,color:C.ts,marginTop:1,lineHeight:1.3}}>{lt.name.replace(" Leave","")}</div>
                        <div style={{fontSize:7,color:C.tm}}>/{lt.maxDays||14}d</div>
                      </div>
                    );})}
                  </div>

                  {/* Apply button */}
                  {!showLeaveForm?(
                    <button onClick={function(){setShowLeaveForm(true);}}
                      style={{width:"100%",background:C.amber,color:"#fff",border:"none",borderRadius:10,
                        padding:"10px",fontSize:11,fontWeight:700,cursor:"pointer",marginBottom:12}}>
                      + Apply Leave
                    </button>
                  ):(
                    <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:10,padding:"12px",marginBottom:12}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.tp,marginBottom:8}}>New Leave Application</div>
                      <select value={leaveForm.type} onChange={function(e){setLeaveForm(function(f){return Object.assign({},f,{type:e.target.value});});}}
                        style={{width:"100%",border:"1px solid "+C.border,borderRadius:6,padding:"6px",fontSize:10,marginBottom:6,color:C.tp,background:"#fff"}}>
                        {leaveTypes.map(function(lt){return <option key={lt.name} value={lt.name}>{lt.name}</option>;})}
                      </select>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                        <div>
                          <div style={{fontSize:8,color:C.ts,marginBottom:2}}>From</div>
                          <input type="date" value={leaveForm.from} onChange={function(e){setLeaveForm(function(f){return Object.assign({},f,{from:e.target.value});});}}
                            style={{width:"100%",border:"1px solid "+C.border,borderRadius:6,padding:"5px",fontSize:9,color:C.tp}}/>
                        </div>
                        <div>
                          <div style={{fontSize:8,color:C.ts,marginBottom:2}}>To</div>
                          <input type="date" value={leaveForm.to} onChange={function(e){setLeaveForm(function(f){return Object.assign({},f,{to:e.target.value});});}}
                            style={{width:"100%",border:"1px solid "+C.border,borderRadius:6,padding:"5px",fontSize:9,color:C.tp}}/>
                        </div>
                      </div>
                      <input type="text" placeholder="Reason (optional)" value={leaveForm.note}
                        onChange={function(e){setLeaveForm(function(f){return Object.assign({},f,{note:e.target.value});});}}
                        style={{width:"100%",border:"1px solid "+C.border,borderRadius:6,padding:"6px",fontSize:9,marginBottom:8,color:C.tp}}/>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={submitLeave} style={{flex:1,background:C.amber,color:"#fff",border:"none",borderRadius:8,padding:"7px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Submit</button>
                        <button onClick={function(){setShowLeaveForm(false);}} style={{flex:1,background:C.surface,color:C.ts,border:"1px solid "+C.border,borderRadius:8,padding:"7px",fontSize:10,cursor:"pointer"}}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Leave history */}
                  <div style={{fontSize:9,fontWeight:700,color:C.ts,letterSpacing:.5,marginBottom:6}}>MY APPLICATIONS</div>
                  {myLeaves.length===0&&<div style={{fontSize:10,color:C.tm,textAlign:"center",padding:12}}>No leave records</div>}
                  {myLeaves.slice(0,6).map(function(l){
                    var sCol=l.status==="Approved"?C.green:l.status==="Rejected"?C.red:C.amber;
                    return(
                      <div key={l.id} style={{background:"#fff",border:"1px solid "+C.border,borderLeft:"3px solid "+sCol,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:10,fontWeight:600,color:C.tp}}>{l.type}</span>
                          <span style={{fontSize:8,color:sCol,fontWeight:700}}>{l.status}</span>
                        </div>
                        <div style={{fontSize:9,color:C.ts}}>{l.from} – {l.to} · {l.days}d</div>
                        {l.note&&<div style={{fontSize:8,color:C.tm,marginTop:2}}>{l.note}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ATTENDANCE TAB ── */}
            {mobileTab==="attendance"&&(
              <div style={{flex:1,overflowY:"auto"}}>
                <div style={{background:"linear-gradient(135deg,#059669,#047857)",padding:"16px",color:"#fff"}}>
                  <div style={{fontSize:9,opacity:.7,marginBottom:4}}>ATTENDANCE</div>
                  <div style={{fontSize:14,fontWeight:800}}>Clock In / Out</div>
                </div>
                <div style={{padding:"12px 12px 80px"}}>
                  {/* Clock status */}
                  <div style={{background:clockedIn?"#D1FAE5":"#fff",border:"1px solid "+(clockedIn?"#34D399":C.border),borderRadius:12,padding:"16px",textAlign:"center",marginBottom:12}}>
                    <div style={{fontSize:28,fontWeight:800,fontFamily:"monospace",color:clockedIn?C.green:C.tp,letterSpacing:2,marginBottom:8}}>
                      {nowTimeStr}
                    </div>
                    <div style={{fontSize:10,color:C.ts,marginBottom:12}}>{nowDateStr}</div>
                    <button onClick={handleClock} style={{
                      background:clockedIn?"#FF3B5C":C.green,color:"#fff",border:"none",
                      borderRadius:30,padding:"12px 32px",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:.5,
                      boxShadow:"0 4px 16px rgba(0,0,0,.2)"}}>
                      {clockedIn?"⏹ CLOCK OUT":"▶ CLOCK IN"}
                    </button>
                    {clockedIn&&clockTime&&(
                      <div style={{marginTop:8,fontSize:10,color:C.green,fontWeight:600}}>
                        ● Working since {clockTime}
                      </div>
                    )}
                  </div>

                  {/* Today summary */}
                  <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                    <div style={{fontSize:9,fontWeight:700,color:C.ts,marginBottom:6,letterSpacing:.5}}>TODAY</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                      {[
                        {l:"Check In",  v:punchHistory.slice().reverse().find(function(p){return p.type==="IN";})?punchHistory.slice().reverse().find(function(p){return p.type==="IN";}).time:"—",c:C.green},
                        {l:"Check Out", v:punchHistory.slice().reverse().find(function(p){return p.type==="OUT";})?punchHistory.slice().reverse().find(function(p){return p.type==="OUT";}).time:"—",c:C.red},
                        {l:"Status",    v:clockedIn?"Active":"—",c:clockedIn?C.green:C.tm},
                      ].map(function(item){return(
                        <div key={item.l} style={{textAlign:"center"}}>
                          <div style={{fontSize:8,color:C.ts,marginBottom:3}}>{item.l}</div>
                          <div style={{fontSize:13,fontWeight:700,color:item.c}}>{item.v}</div>
                        </div>
                      );})}
                    </div>
                  </div>

                  {/* Punch log */}
                  {punchHistory.length>0&&(
                    <div>
                      <div style={{fontSize:9,fontWeight:700,color:C.ts,marginBottom:6,letterSpacing:.5}}>PUNCH LOG</div>
                      {punchHistory.slice(0,5).map(function(p,i){return(
                        <div key={i} style={{background:"#fff",border:"1px solid "+C.border,borderLeft:"3px solid "+(p.type==="IN"?C.green:C.red),borderRadius:8,padding:"7px 10px",marginBottom:5,display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontSize:10,color:p.type==="IN"?C.green:C.red,fontWeight:700}}>{p.type==="IN"?"▶ Clock In":"⏹ Clock Out"}</span>
                          <span style={{fontSize:10,color:C.ts}}>{p.time} · {p.date}</span>
                        </div>
                      );})}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── CLAIMS TAB ── */}
            {mobileTab==="schedule"&&(
              <div style={{flex:1,overflowY:"auto"}}>
                <div style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",padding:"16px",color:"#fff"}}>
                  <div style={{fontSize:9,opacity:.7,marginBottom:4}}>MY SCHEDULE</div>
                  <div style={{fontSize:14,fontWeight:800}}>Working Schedule</div>
                </div>
                <div style={{padding:"12px 12px 80px"}}>
                  {(function(){
                    var myWh   = gWh[me.id] || {};
                    var mySched= gSched[me.id] || null;
                    var SP     = INIT_SHIFT_PRESETS;
                    var days   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
                    var dayFull= ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
                    var today  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];

                    // Determine shift per day
                    function getDayShift(dayKey){
                      if(mySched && mySched[dayKey]){
                        return getShiftById(mySched[dayKey], SP);
                      }
                      if(gSchedMode==="on"){
                        return getShiftById(gUnified[dayKey]||"off", SP);
                      }
                      // Fallback to work hours
                      if(myWh.start&&myWh.end){
                        var isWeekend=dayKey==="Sat"||dayKey==="Sun";
                        if(isWeekend) return getShiftById("off",SP);
                        return {id:"custom",name:"Work Hours",start:myWh.start,end:myWh.end,brk:myWh.brk||60,color:C.accent};
                      }
                      return getShiftById("off",SP);
                    }

                    var weeklyHrs = days.reduce(function(sum,d){
                      var sh=getDayShift(d);
                      return sum+(sh.id==="off"?0:calcNetHours(sh.start,sh.end,sh.brk));
                    },0);

                    return React.createElement(React.Fragment,null,
                      // Summary strip
                      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}},
                        React.createElement("div",{style:{background:C.accentL,borderRadius:10,padding:"10px 12px"}},
                          React.createElement("div",{style:{fontSize:8,color:C.ts,marginBottom:2,letterSpacing:.5}},"WEEKLY HOURS"),
                          React.createElement("div",{style:{fontSize:20,fontWeight:800,color:C.accent}},weeklyHrs.toFixed(1)+"h")
                        ),
                        React.createElement("div",{style:{background:C.greenL,borderRadius:10,padding:"10px 12px"}},
                          React.createElement("div",{style:{fontSize:8,color:C.ts,marginBottom:2,letterSpacing:.5}},"WORK DAYS"),
                          React.createElement("div",{style:{fontSize:20,fontWeight:800,color:C.green}},
                            days.filter(function(d){return getDayShift(d).id!=="off";}).length+" days"
                          )
                        )
                      ),
                      // Shift info card (if using work hours)
                      myWh.start&&React.createElement("div",{style:{background:"#fff",border:"1px solid "+C.border,borderRadius:10,padding:"10px 12px",marginBottom:10}},
                        React.createElement("div",{style:{fontSize:9,fontWeight:700,color:C.ts,marginBottom:6,letterSpacing:.5}},"SHIFT DETAILS"),
                        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}},
                          React.createElement("span",{style:{color:C.ts}},"Start Time"),
                          React.createElement("span",{style:{fontWeight:700,color:C.tp}},myWh.start||"—")
                        ),
                        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}},
                          React.createElement("span",{style:{color:C.ts}},"End Time"),
                          React.createElement("span",{style:{fontWeight:700,color:C.tp}},myWh.end||"—")
                        ),
                        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}},
                          React.createElement("span",{style:{color:C.ts}},"Break"),
                          React.createElement("span",{style:{fontWeight:700,color:C.tp}},(myWh.brk||60)+" min")
                        ),
                        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:10}},
                          React.createElement("span",{style:{color:C.ts}},"Flexible"),
                          React.createElement("span",{style:{fontWeight:700,color:myWh.flexible?C.green:C.ts}},myWh.flexible?"Yes":"No")
                        )
                      ),
                      // Day-by-day schedule
                      React.createElement("div",{style:{fontSize:9,fontWeight:700,color:C.ts,marginBottom:6,letterSpacing:.5}},"WEEKLY SCHEDULE"),
                      days.map(function(d,i){
                        var sh=getDayShift(d);
                        var isToday=d===today;
                        var isOff=sh.id==="off";
                        return React.createElement("div",{key:d,style:{
                          background:isToday?"linear-gradient(135deg,"+C.accentL+",#E8EEFF)":"#fff",
                          border:"1px solid "+(isToday?C.accent:C.border),
                          borderLeft:"3px solid "+(isOff?"#CBD5E1":sh.color||C.accent),
                          borderRadius:9,padding:"9px 11px",marginBottom:5,
                          display:"flex",justifyContent:"space-between",alignItems:"center"
                        }},
                          React.createElement("div",null,
                            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:5}},
                              React.createElement("span",{style:{fontSize:10,fontWeight:isToday?800:600,color:isToday?C.accent:C.tp}},dayFull[i]),
                              isToday&&React.createElement("span",{style:{fontSize:7,background:C.accent,color:"#fff",borderRadius:4,padding:"1px 5px",fontWeight:700}},"TODAY")
                            ),
                            React.createElement("div",{style:{fontSize:9,color:isOff?C.tm:C.ts,marginTop:2}},
                              isOff?"Rest Day":sh.start+" – "+sh.end+" · "+(sh.brk||60)+"min break"
                            )
                          ),
                          React.createElement("div",{style:{textAlign:"right"}},
                            React.createElement("div",{style:{fontSize:10,fontWeight:700,color:isOff?"#CBD5E1":sh.color||C.accent}},
                              sh.name||(isOff?"Off":"Work")
                            ),
                            !isOff&&React.createElement("div",{style:{fontSize:8,color:C.tm,marginTop:1}},
                              calcNetHours(sh.start,sh.end,sh.brk).toFixed(1)+"h"
                            )
                          )
                        );
                      })
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Bottom nav */}
            <div style={{background:"#fff",borderTop:"1px solid "+C.border,display:"grid",gridTemplateColumns:"repeat(4,1fr)",flexShrink:0}}>
              {[
                {id:"home",     label:"Home",     icon:<LayoutDashboard size={14}/>},
                {id:"payslip",  label:"Pay",      icon:<DollarSign size={14}/>},
                {id:"leave",    label:"Leave",    icon:<Umbrella size={14}/>},
                {id:"schedule", label:"Schedule", icon:<Calendar size={14}/>},
              ].map(function(t){return(
                <button key={t.id} onClick={function(){setMobileTab(t.id);}}
                  style={{background:"none",border:"none",padding:"8px 0 5px",cursor:"pointer",
                    display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                    color:mobileTab===t.id?C.accent:C.tm,fontFamily:"inherit"}}>
                  {t.icon}
                  <span style={{fontSize:8,fontWeight:mobileTab===t.id?700:400}}>{t.label}</span>
                  {mobileTab===t.id&&<div style={{width:3,height:3,borderRadius:"50%",background:C.accent}}/>}
                </button>
              );})}
            </div>
          </div>
        </div>

        {/* Home bar */}
        <div style={{width:70,height:4,background:"#2a2a3e",borderRadius:4,margin:"10px auto 0"}}/>
      </div>

      {/* ── SIDE INFO PANEL ── */}
      <div style={{maxWidth:320,flex:1,minWidth:260}}>

        {/* Employee card */}
        <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:14,padding:"16px",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:C.ts,letterSpacing:.5,marginBottom:10}}>CONNECTED AS</div>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
            <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>
              {(me.preferredName||me.name||"E").charAt(0)}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.tp}}>{me.name||"—"}</div>
              <div style={{fontSize:10,color:C.ts,marginTop:1}}>{me.position||"—"} · {me.dept||"—"}</div>
              <div style={{fontSize:9,color:C.tm,marginTop:1}}>{me.empNo||"—"} · {me.status||"—"}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:9,color:C.ts}}>
            {[
              ["Join Date",me.joinDate||"—"],["Grade",me.grade||"—"],
              ["EPF No",me.epfNo||"—"],["Tax No",me.taxNo||"—"],
            ].map(function(r){return(
              <div key={r[0]}>
                <div style={{color:C.tm,marginBottom:1}}>{r[0]}</div>
                <div style={{color:C.tp,fontWeight:600}}>{r[1]}</div>
              </div>
            );})}
          </div>
        </div>

        {/* Latest payroll */}
        <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:14,padding:"16px",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:C.ts,letterSpacing:.5,marginBottom:10}}>PAYROLL · {latestBatch?latestBatch.period:"—"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {l:"Gross Pay",   v:"RM "+fmt(myRow.grossTotal||0), c:C.green},
              {l:"Net Pay",     v:"RM "+fmt(myRow.netTotal||0),   c:C.green, bold:true},
              {l:"EPF (EE)",    v:"RM "+fmt(myRow.epfEe||0),      c:C.ts},
              {l:"PCB/MTD",     v:"RM "+fmt(myRow.pcb||0),        c:C.purple},
              {l:"SOCSO",       v:"RM "+fmt(myRow.socsoEe||0),    c:C.ts},
              {l:"EIS",         v:"RM "+fmt(myRow.eisEe||0),      c:C.ts},
            ].map(function(item){return(
              <div key={item.l} style={{background:item.bold?C.greenL:C.surface,borderRadius:8,padding:"8px 10px"}}>
                <div style={{fontSize:8,color:C.tm,marginBottom:2}}>{item.l}</div>
                <div style={{fontSize:12,fontWeight:item.bold?800:600,color:item.c||C.tp}}>{item.v}</div>
              </div>
            );})}
          </div>
        </div>

        {/* Recent leaves */}
        <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:14,padding:"16px",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:C.ts,letterSpacing:.5,marginBottom:10}}>RECENT LEAVES</div>
          {myLeaves.length===0&&<div style={{fontSize:10,color:C.tm}}>No leave records</div>}
          {myLeaves.slice(0,4).map(function(l){
            var sCol=l.status==="Approved"?C.green:l.status==="Rejected"?C.red:C.amber;
            return(
              <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,paddingBottom:8,borderBottom:"1px solid "+C.border}}>
                <div>
                  <div style={{fontSize:10,fontWeight:600,color:C.tp}}>{l.type}</div>
                  <div style={{fontSize:9,color:C.ts,marginTop:1}}>{l.from} – {l.to} · {l.days}d</div>
                </div>
                <div style={{fontSize:9,fontWeight:700,color:sCol}}>{l.status}</div>
              </div>
            );
          })}
        </div>

        {/* Company info */}
        <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:14,padding:"16px"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.ts,letterSpacing:.5,marginBottom:8}}>COMPANY</div>
          <div style={{fontSize:12,fontWeight:700,color:C.tp,marginBottom:4}}>{co.name||"—"}</div>
          {[
            ["SSM",co.ssmNo||"—"],["LHDN",co.lhdnNo||"—"],["EPF",co.epfNo||"—"],
          ].map(function(r){return(
            <div key={r[0]} style={{fontSize:9,color:C.ts,marginBottom:3}}>
              <span style={{color:C.tm,marginRight:6}}>{r[0]}:</span>{r[1]}
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}
// -- MAIN APP
export default function HRSaaS() {
  var [active, setActive] = useState("dashboard");
  var [employees, setEmployees] = useState(INIT_EMPLOYEES);
  var [rolePerms, setRolePerms] = useState(INIT_ROLE_PERMS);
  var [viewRole, setViewRole] = useState("HR Manager");
  var [companies, setCompanies] = useState(INIT_COMPANIES);
  var [activeCompany, setActiveCompany] = useState("CO001");
  var [hrConfig, setHrConfig] = useState(INIT_HR_CONFIG);
  var [leaveConfig, setLeaveConfig] = useState(INIT_LEAVE_CONFIG);
  var [payrollConfig, setPayrollConfig] = useState(INIT_PAYROLL_CONFIG);
  var _gSched  = useState({});    var gSched  = _gSched[0];  var setGSched  = _gSched[1];
  var _gWh     = useState({
    "E001":{start:"08:00",end:"17:00",brk:60,flexible:false,ot:true},
    "E002":{start:"08:00",end:"17:00",brk:60,flexible:false,ot:false},
    "E003":{start:"09:00",end:"18:00",brk:60,flexible:true, ot:true},
    "E004":{start:"08:30",end:"17:30",brk:60,flexible:false,ot:true},
    "E005":{start:"08:00",end:"17:00",brk:60,flexible:false,ot:false},
  });
  var gWh = _gWh[0]; var setGWh = _gWh[1];
  var [gUnified, setGUnified] = useState({Mon:"morning",Tue:"morning",Wed:"morning",Thu:"morning",Fri:"morning",Sat:"off",Sun:"off"});
  var [gSchedMode, setGSchedMode] = useState("off");
  var _gSP = useState(INIT_SHIFT_PRESETS.map(function(s){return Object.assign({},s);}));
  var gShiftPresets = _gSP[0]; var setGShiftPresets = _gSP[1];
  var [globalLeaves, setGlobalLeaves] = useState(INIT_LEAVE_DATA);
  var [globalBatches, setGlobalBatches] = useState(PAYROLL_BATCHES_INIT);
  var [licenses, setLicenses] = useState(INIT_LICENSES);

  // ── AUTH STATE ──
  var [authState, setAuthState] = useState({loggedIn:false,emp:null,role:null,isPlatformAdmin:false,admin:null});
  var [loginId, setLoginId]     = useState("");
  var [loginPw, setLoginPw]     = useState("");
  var [loginErr, setLoginErr]   = useState("");
  var [loginMode, setLoginMode] = useState("employee"); // "employee" | "superadmin" | "platform"
  var [showPw, setShowPw]       = useState(false);
  var [platformView, setPlatformView] = useState("dashboard"); // platform admin sub-pages
  var [apiConfig, setApiConfigState] = useState(getStoredApiConfig());
  var [showApiModal, setShowApiModal] = useState(false);
  var [apiLoading, setApiLoading] = useState(false);

  function saveApiConfig(cfg) {
    setApiConfig(cfg);
    setApiConfigState(cfg);
  }

  var co = companies.find(function(c) { return c.id === activeCompany; }) || companies[0] || {};
  var currentLicense = licenses[activeCompany] || null;
  var licenseOk = checkLicense(currentLicense, employees.filter(function(e){return e.status!=="Terminated";}).length);

  // After login, sync viewRole to the logged-in employee role
  var effectiveRole = authState.isPlatformAdmin ? "Super Admin" : (authState.role || viewRole);
  var visibleMods = rolePerms[effectiveRole] || new Set();
  var NAV = ALL_MODULES.filter(function(m) { return visibleMods.has(m.id); });
  var safeActive = visibleMods.has(active) ? active : (NAV[0] ? NAV[0].id : "dashboard");
  var activeModule = safeActive;

  async function doLogin(){
    setLoginErr(""); setApiLoading(true);

    // ── Try API login first if configured
    if(apiConfig.enabled && apiConfig.baseUrl){
      var apiRes = await api.login(loginMode, loginId.trim(), loginPw.trim(), activeCompany);
      setApiLoading(false);
      if(apiRes && apiRes.accessToken){
        setTokens(apiRes.accessToken, apiRes.refreshToken);
        var u = apiRes.user || {};
        var isPA = apiRes.userType === "platform_admin";
        var isSA = apiRes.userType === "super_admin";
        setAuthState({loggedIn:true,emp:u,role:apiRes.role,isPlatformAdmin:isPA,isSuperAdmin:isSA,admin:isPA||isSA?u:null});
        if(apiRes.role) setViewRole(apiRes.role==="Super Admin"?"Super Admin":apiRes.role);
        // Sync employees from API
        var empData = await api.getEmployees();
        if(empData && empData.data) setEmployees(empData.data);
        // Sync batches from API
        var batchData = await api.getBatches();
        if(batchData) setGlobalBatches(batchData);
        // Sync leaves from API
        var leaveData = await api.getLeaves();
        if(leaveData) setGlobalLeaves(leaveData);
        setLoginId(""); setLoginPw("");
        return;
      } else if(apiRes && apiRes.error) {
        setLoginErr(apiRes.error || "Login failed");
        return;
      }
      // Fall through to offline mode if API unreachable
      setLoginErr("API unreachable — using offline mode");
    }

    setApiLoading(false);

    // ── Offline / demo login
    var res = authenticate(
      loginId.trim(), loginPw.trim(), employees,
      loginMode==="platform",
      loginMode==="superadmin",
      companies, activeCompany
    );
    if(!res.ok){ setLoginErr(res.error); return; }
    if(!res.isPlatformAdmin){
      var lc = checkLicense(licenses[activeCompany], employees.filter(function(e){return e.status!=="Terminated";}).length);
      if(!lc.ok){ setLoginErr("System unavailable: "+lc.msg); return; }
    }
    setAuthState({loggedIn:true,emp:res.emp,role:res.role,isPlatformAdmin:res.isPlatformAdmin,isSuperAdmin:res.isSuperAdmin||false,admin:res.admin||null});
    if(res.role) setViewRole(res.role==="Super Admin"?"Super Admin":res.role);
    setLoginId(""); setLoginPw("");
  }

  async function doLogout(){
    if(apiConfig.enabled && _accessToken) await api.logout();
    clearTokens();
    setAuthState({loggedIn:false,emp:null,role:null,isPlatformAdmin:false,admin:null});
    setViewRole("HR Manager");
    setActive("dashboard");
    setPlatformView("dashboard");
  }

/* ══════════════════════════════════════════════════════
   PLATFORM ADMIN PANEL  — top-level component (no nested hooks)
══════════════════════════════════════════════════════ */
function PlatformAdminPanel(props){
  var companies    = props.companies    || [];
  var setCompanies = props.setCompanies || function(){};
  var employees    = props.employees    || [];
  var licenses     = props.licenses     || {};
  var setLicenses  = props.setLicenses  || function(){};
  var authState    = props.authState    || {};
  var doLogout     = props.doLogout     || function(){};

  var _pTab=useState("dashboard"); var pTab=_pTab[0]; var setPTab=_pTab[1];
  var _editLic=useState(null); var editLic=_editLic[0]; var setEditLic=_editLic[1];
  var _addAdminForm=useState({id:"",name:"",email:"",pin:""}); var addAdminForm=_addAdminForm[0]; var setAddAdminForm=_addAdminForm[1];
  var [platAdmins, setPlatAdmins] = useState(PLATFORM_ADMINS.slice());
  var [toast, setToast] = useState(null);
  function showToast(m,ok){ setToast({m:m,ok:ok!==false}); setTimeout(function(){setToast(null);},2800); }

  var totalStaff = employees.filter(function(e){return e.status!=="Terminated";}).length;
  var totalRevenue = companies.reduce(function(s,co){
    var lic=licenses[co.id]; if(!lic)return s;
    var tier=LICENSE_TIERS.find(function(t){return t.id===lic.tier;});
    return s+(tier?tier.price:0);
  },0);
  var activeLicenses=Object.values(licenses).filter(function(l){return l.status==="Active";}).length;

  return (
    <div style={{minHeight:"100vh",background:"#0a0a14",fontFamily:"'DM Sans',system-ui,sans-serif",color:"#e8e8f0"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#2a2a3e;border-radius:10px}`}</style>
      {/* Topbar */}
      <div style={{background:"#0d0d1a",borderBottom:"1px solid #1e1e30",padding:"0 28px",height:58,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#E5374A,#B91C1C)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff"}}>P</div>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:"#fff",letterSpacing:.5}}>HRCloud Platform Admin</div>
            <div style={{fontSize:10,color:"#555",marginTop:1}}>Vendor Management Console</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{fontSize:11,color:"#555"}}>Logged in as <strong style={{color:"#E5374A"}}>{authState.admin?authState.admin.name:"Admin"}</strong></div>
          <button onClick={doLogout} style={{background:"#1e1e2e",border:"1px solid #2a2a3e",color:"#888",borderRadius:8,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Logout</button>
        </div>
      </div>
      <div style={{display:"flex",height:"calc(100vh - 58px)"}}>
        {/* Sidebar */}
        <div style={{width:200,background:"#0d0d1a",borderRight:"1px solid #1e1e30",padding:"16px 0",flexShrink:0}}>
          {[
            {id:"dashboard",label:"Dashboard",ico:"⬛"},
            {id:"licenses", label:"Licenses",  ico:"🔑"},
            {id:"companies",label:"Companies",  ico:"🏢"},
            {id:"admins",   label:"Admins",     ico:"👤"},
            {id:"audit",    label:"Audit Log",  ico:"📋"},
          ].map(function(item){return(
            <button key={item.id} onClick={function(){setPTab(item.id);}}
              style={{width:"100%",background:pTab===item.id?"#1e1e2e":"none",border:"none",
                borderLeft:pTab===item.id?"3px solid #E5374A":"3px solid transparent",
                color:pTab===item.id?"#fff":"#555",padding:"10px 18px",textAlign:"left",
                cursor:"pointer",fontSize:12,fontFamily:"inherit",display:"flex",alignItems:"center",gap:8,transition:"all .15s"}}>
              <span>{item.ico}</span>{item.label}
            </button>
          );})}
        </div>
        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:28}}>
          {toast&&<div style={{position:"fixed",top:70,right:28,zIndex:999,background:toast.ok?"#00E5A022":"#FF3B5C22",border:"1px solid "+(toast.ok?"#00E5A055":"#FF3B5C55"),color:toast.ok?"#00E5A0":"#FF3B5C",padding:"10px 20px",borderRadius:20,fontSize:12,fontWeight:600}}>{toast.m}</div>}

          {/* ── DASHBOARD ── */}
          {pTab==="dashboard"&&(
            <div>
              <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>Platform Overview</div>
              <div style={{fontSize:12,color:"#555",marginBottom:24}}>HRCloud SaaS — Vendor Administration</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
                {[
                  {l:"Total Companies", v:companies.length,  c:"#4F6EF7"},
                  {l:"Active Licenses", v:activeLicenses,     c:"#00E5A0"},
                  {l:"Total Staff",     v:totalStaff,         c:"#FF9500"},
                  {l:"MRR (RM)",        v:"RM "+totalRevenue, c:"#E5374A"},
                ].map(function(s){return(
                  <div key={s.l} style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:12,padding:"16px 18px"}}>
                    <div style={{fontSize:10,color:"#555",letterSpacing:1,marginBottom:6}}>{s.l}</div>
                    <div style={{fontSize:26,fontWeight:800,color:s.c}}>{s.v}</div>
                  </div>
                );})}
              </div>
              <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:12,padding:18}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>Company Licenses</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid #1e1e30"}}>
                      {["Company","Tier","Staff Used","Max Staff","Status","Expiry","MRR"].map(function(h){return <th key={h} style={{textAlign:"left",color:"#555",padding:"6px 10px",fontWeight:600}}>{h}</th>;})}
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map(function(co2){
                      var lic=licenses[co2.id]||{};
                      var used=employees.filter(function(e){return e.status!=="Terminated";}).length;
                      var tier=LICENSE_TIERS.find(function(t){return t.id===lic.tier;})||{};
                      var lOk=checkLicense(lic,used);
                      return(
                        <tr key={co2.id} style={{borderBottom:"1px solid #1a1a2e"}}>
                          <td style={{padding:"8px 10px",color:"#e8e8f0",fontWeight:600}}>{co2.name}</td>
                          <td style={{padding:"8px 10px"}}><span style={{background:(tier.color||"#888")+"22",color:tier.color||"#888",border:"1px solid "+(tier.color||"#888")+"44",borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700}}>{lic.tier||"—"}</span></td>
                          <td style={{padding:"8px 10px",color:"#FF9500"}}>{used}</td>
                          <td style={{padding:"8px 10px",color:"#e8e8f0"}}>{lic.maxStaff||"—"}</td>
                          <td style={{padding:"8px 10px"}}><span style={{color:lOk.ok?"#00E5A0":"#FF3B5C",fontWeight:700}}>{lic.status||"—"}</span></td>
                          <td style={{padding:"8px 10px",color:"#555"}}>{lic.expiry||"—"}</td>
                          <td style={{padding:"8px 10px",color:"#E5374A",fontWeight:700}}>RM {tier.price||0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── LICENSES ── */}
          {pTab==="licenses"&&(
            <div>
              <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>License Management</div>
              <div style={{fontSize:12,color:"#555",marginBottom:24}}>Issue, renew, and manage company licenses</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:24}}>
                {LICENSE_TIERS.map(function(t){return(
                  <div key={t.id} style={{background:"#0d0d1a",border:"1px solid "+t.color+"44",borderTop:"3px solid "+t.color,borderRadius:12,padding:"14px 12px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:t.color,marginBottom:4}}>{t.label}</div>
                    <div style={{fontSize:18,fontWeight:800,color:"#e8e8f0",marginBottom:2}}>RM {t.price}<span style={{fontSize:10,color:"#555"}}>/mo</span></div>
                    <div style={{fontSize:10,color:"#555"}}>Up to {t.maxStaff===9999?"Unlimited":t.maxStaff} staff</div>
                  </div>
                );})}
              </div>
              {companies.map(function(co2){
                var lic=licenses[co2.id]||{tier:"starter",maxStaff:10,status:"Active",expiry:"2026-12-31",key:""};
                var isEdit=editLic===co2.id;
                var used=employees.filter(function(e){return e.status!=="Terminated";}).length;
                var lOk=checkLicense(lic,used);
                var tier=LICENSE_TIERS.find(function(t){return t.id===lic.tier;})||{color:"#888"};
                return(
                  <LicenseEditCard key={co2.id} co2={co2} lic={lic} isEdit={isEdit} used={used} lOk={lOk} tier={tier}
                    onToggleEdit={function(){setEditLic(isEdit?null:co2.id);}}
                    onSave={function(ef){
                      setLicenses(function(prev){return Object.assign({},prev,{[co2.id]:Object.assign({},ef,{issuedBy:authState.admin?authState.admin.id:"PA001",issuedOn:new Date().toISOString().split("T")[0]})});});
                      setEditLic(null); showToast("License updated for "+co2.name);
                    }}/>
                );
              })}
            </div>
          )}

          {/* ── COMPANIES ── */}
          {pTab==="companies"&&(
            <div>
              <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>Company Management</div>
              <div style={{fontSize:12,color:"#555",marginBottom:20}}>Registered client companies · Super Admin credentials</div>
              {companies.map(function(co2){
                var lic=licenses[co2.id]||{};
                var tier=LICENSE_TIERS.find(function(t){return t.id===lic.tier;})||{color:"#888",label:"—"};
                return(
                  <SuperAdminCard key={co2.id} co2={co2} lic={lic} tier={tier}
                    onSave={function(updated){
                      setCompanies(function(prev){return prev.map(function(c){return c.id===co2.id?Object.assign({},c,updated):c;});});
                      showToast("Super Admin updated for "+co2.name);
                    }}/>
                );
              })}
            </div>
          )}

          {/* ── ADMINS ── */}
          {pTab==="admins"&&(
            <div>
              <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>Platform Administrators</div>
              <div style={{fontSize:12,color:"#555",marginBottom:20}}>Manage vendor admin accounts</div>
              {platAdmins.map(function(a){return(
                <div key={a.id} style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderLeft:"3px solid #E5374A",borderRadius:12,padding:"14px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#e8e8f0"}}>{a.name}</div>
                    <div style={{fontSize:10,color:"#555",marginTop:2}}>{a.id} · {a.email}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:10,background:"#E5374A22",color:"#E5374A",border:"1px solid #E5374A44",borderRadius:20,padding:"2px 10px",fontWeight:700}}>{a.role}</span>
                    {platAdmins.length>1&&<button onClick={function(){setPlatAdmins(function(prev){return prev.filter(function(x){return x.id!==a.id;});});showToast("Admin removed");}}
                      style={{background:"none",border:"1px solid #2a2a3e",color:"#555",borderRadius:8,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>}
                  </div>
                </div>
              );})}
              <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:12,padding:16,marginTop:12}}>
                <div style={{fontSize:12,fontWeight:700,color:"#e8e8f0",marginBottom:12}}>+ Add Platform Admin</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                  {[{l:"Admin ID",k:"id",ph:"PA003"},{l:"Full Name",k:"name",ph:"John Doe"},{l:"Email",k:"email",ph:"admin@hrcloud.my"},{l:"PIN",k:"pin",ph:"Secret123"}].map(function(f){return(
                    <div key={f.k}>
                      <div style={{fontSize:9,color:"#555",marginBottom:4,letterSpacing:.5}}>{f.l}</div>
                      <input value={addAdminForm[f.k]} placeholder={f.ph}
                        onChange={function(e){var v=e.target.value;setAddAdminForm(function(p){return Object.assign({},p,{[f.k]:v});});}}
                        style={{width:"100%",background:"#0a0a14",border:"1px solid #2a2a3e",color:"#e8e8f0",borderRadius:8,padding:"7px 10px",fontSize:11,fontFamily:"inherit"}}/>
                    </div>
                  );})}
                </div>
                <button onClick={function(){
                  if(!addAdminForm.id||!addAdminForm.name||!addAdminForm.pin){showToast("Fill all fields",false);return;}
                  setPlatAdmins(function(prev){return prev.concat([Object.assign({},addAdminForm,{role:"Platform Admin"})]);});
                  setAddAdminForm({id:"",name:"",email:"",pin:""});showToast("Admin added");
                }} style={{marginTop:12,background:"#E5374A",border:"none",color:"#fff",borderRadius:8,padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  Add Admin
                </button>
              </div>
            </div>
          )}

          {/* ── AUDIT LOG ── */}
          {pTab==="audit"&&(
            <div>
              <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>Audit Log</div>
              <div style={{fontSize:12,color:"#555",marginBottom:20}}>Platform-level activity trail</div>
              {[
                {t:"2026-03-09 09:01",a:"PA001",msg:"License updated for TechCorp Sdn. Bhd. → Growth tier"},
                {t:"2026-03-09 08:55",a:"PA001",msg:"Platform login successful"},
                {t:"2026-03-08 17:30",a:"PA002",msg:"New company registered: TechCorp Logistics Sdn. Bhd."},
                {t:"2026-03-07 14:22",a:"PA001",msg:"License renewed for CO002 → 2026-06-30"},
                {t:"2026-03-05 10:11",a:"PA001",msg:"Admin account PA002 created"},
              ].map(function(row,i){return(
                <div key={i} style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",gap:14,alignItems:"flex-start"}}>
                  <div style={{fontSize:9,color:"#333",fontFamily:"monospace",whiteSpace:"nowrap",marginTop:2}}>{row.t}</div>
                  <div style={{flex:1}}>
                    <span style={{fontSize:10,background:"#E5374A22",color:"#E5374A",border:"1px solid #E5374A44",borderRadius:4,padding:"1px 6px",marginRight:8,fontWeight:700}}>{row.a}</span>
                    <span style={{fontSize:11,color:"#e8e8f0"}}>{row.msg}</span>
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* SuperAdminCard — per-company super admin credential management */
function SuperAdminCard(props){
  var co2=props.co2, lic=props.lic, tier=props.tier, onSave=props.onSave;
  var _edit=useState(false); var edit=_edit[0]; var setEdit=_edit[1];
  var _form=useState({superAdminId:co2.superAdminId||"",superAdminName:co2.superAdminName||"",superAdminPin:co2.superAdminPin||""});
  var form=_form[0]; var setForm=_form[1];
  var [showPin, setShowPin] = useState(false);
  React.useEffect(function(){setForm({superAdminId:co2.superAdminId||"",superAdminName:co2.superAdminName||"",superAdminPin:co2.superAdminPin||""});},[edit]);
  return(
    <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderLeft:"3px solid "+(tier.color||"#888"),borderRadius:12,padding:16,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:edit?14:0}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"#e8e8f0"}}>{co2.name}</div>
          <div style={{fontSize:10,color:"#555",marginTop:2}}>SSM: {co2.ssmNo||"—"} · {co2.email||"—"}</div>
          <div style={{fontSize:10,color:"#555",marginTop:1}}>{co2.city||"—"}, {co2.state||"—"}</div>
          {/* Super Admin status */}
          <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:10,background:"#FF950022",color:"#FF9500",border:"1px solid #FF950044",borderRadius:6,padding:"2px 8px",fontWeight:700}}>Super Admin</span>
            <span style={{fontSize:10,color:"#555"}}>
              {co2.superAdminId?co2.superAdminId+" · "+co2.superAdminName:"Not configured"}
            </span>
            {co2.superAdminPin&&(
              <span style={{fontSize:9,color:"#2a2a3e",fontFamily:"monospace"}}>
                pw: {showPin?co2.superAdminPin:"••••••••"}
                <button onClick={function(){setShowPin(function(v){return !v;});}} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:9,marginLeft:4,fontFamily:"inherit"}}>{showPin?"hide":"show"}</button>
              </span>
            )}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
          <span style={{fontSize:10,background:(tier.color||"#888")+"22",color:tier.color||"#888",border:"1px solid "+(tier.color||"#888")+"44",borderRadius:20,padding:"3px 12px",fontWeight:700}}>{tier.label||"—"}</span>
          <button onClick={function(){setEdit(function(v){return !v;});}}
            style={{background:edit?"#1e1e2e":"#FF950022",border:"1px solid "+(edit?"#2a2a3e":"#FF950055"),
              color:edit?"#555":"#FF9500",borderRadius:8,padding:"5px 14px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {edit?"Cancel":"Set Super Admin"}
          </button>
        </div>
      </div>
      {edit&&(
        <div>
          <div style={{borderTop:"1px solid #1e1e30",paddingTop:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
            {[
              {l:"Super Admin ID", k:"superAdminId", ph:"e.g. SA001", type:"text"},
              {l:"Display Name",   k:"superAdminName",ph:"e.g. TechCorp Admin",type:"text"},
              {l:"Password",       k:"superAdminPin", ph:"Min 8 chars",type:"password"},
            ].map(function(f){return(
              <div key={f.k}>
                <div style={{fontSize:9,color:"#555",marginBottom:4,letterSpacing:.5}}>{f.l}</div>
                <input type={f.type} value={form[f.k]} placeholder={f.ph}
                  onChange={function(e){var v=e.target.value;setForm(function(p){return Object.assign({},p,{[f.k]:v});});}}
                  style={{width:"100%",background:"#0a0a14",border:"1px solid #2a2a3e",color:"#e8e8f0",borderRadius:8,padding:"7px 10px",fontSize:11,fontFamily:"inherit"}}/>
              </div>
            );})}
          </div>
          <div style={{background:"#FF950011",border:"1px solid #FF950033",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:10,color:"#FF9500"}}>
            ⚠ The Super Admin can access all modules for this company. Use a strong password and store it securely.
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={function(){setEdit(false);}}
              style={{background:"#1e1e2e",border:"1px solid #2a2a3e",color:"#555",borderRadius:8,padding:"7px 16px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
            <button onClick={function(){
              if(!form.superAdminId||!form.superAdminPin){return;}
              if(form.superAdminPin.length<6){return;}
              onSave(form); setEdit(false);
            }} style={{background:"#FF9500",border:"none",color:"#fff",borderRadius:8,padding:"7px 20px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              Save Super Admin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* LicenseEditCard — own component so useState is not inside a map() */
function LicenseEditCard(props){
  var co2=props.co2, lic=props.lic, isEdit=props.isEdit, used=props.used;
  var lOk=props.lOk, tier=props.tier;
  var onToggleEdit=props.onToggleEdit, onSave=props.onSave;
  var _ef=useState(Object.assign({},lic)); var ef=_ef[0]; var setEf=_ef[1];
  React.useEffect(function(){setEf(Object.assign({},lic));},[isEdit]);
  return(
    <div style={{background:"#0d0d1a",border:"1px solid "+(lOk.ok?"#1e1e30":"#FF3B5C44"),borderLeft:"3px solid "+(tier.color||"#888"),borderRadius:12,padding:16,marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:isEdit?12:0}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:"#e8e8f0"}}>{co2.name}</div>
          <div style={{fontSize:10,color:"#555",marginTop:2}}>Key: <span style={{color:"#888",fontFamily:"monospace"}}>{lic.key||"—"}</span></div>
          {!lOk.ok&&<div style={{fontSize:10,color:"#FF3B5C",marginTop:3}}>⚠ {lOk.msg}</div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:10,background:(tier.color||"#888")+"22",color:tier.color||"#888",border:"1px solid "+(tier.color||"#888")+"44",borderRadius:20,padding:"2px 10px",fontWeight:700}}>{lic.tier||"—"}</span>
          <span style={{fontSize:10,color:used>=(lic.maxStaff||0)?"#FF3B5C":"#00E5A0",fontWeight:700}}>{used}/{lic.maxStaff} staff</span>
          <button onClick={onToggleEdit} style={{background:isEdit?"#1e1e2e":"#E5374A22",border:"1px solid "+(isEdit?"#2a2a3e":"#E5374A55"),color:isEdit?"#888":"#E5374A",borderRadius:8,padding:"5px 12px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>
            {isEdit?"Cancel":"Edit"}
          </button>
        </div>
      </div>
      {isEdit&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginTop:8}}>
          <div>
            <div style={{fontSize:9,color:"#555",marginBottom:4,letterSpacing:.5}}>TIER</div>
            <select value={ef.tier} onChange={function(e){
              var t2=LICENSE_TIERS.find(function(t){return t.id===e.target.value;})||{};
              setEf(function(f){return Object.assign({},f,{tier:e.target.value,maxStaff:t2.maxStaff||f.maxStaff});});
            }} style={{width:"100%",background:"#0a0a14",border:"1px solid #2a2a3e",color:"#e8e8f0",borderRadius:8,padding:"6px 8px",fontSize:11,fontFamily:"inherit"}}>
              {LICENSE_TIERS.map(function(t){return <option key={t.id} value={t.id}>{t.label} (max {t.maxStaff===9999?"∞":t.maxStaff})</option>;})}
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:"#555",marginBottom:4,letterSpacing:.5}}>MAX STAFF</div>
            <input type="number" value={ef.maxStaff} onChange={function(e){setEf(function(f){return Object.assign({},f,{maxStaff:parseInt(e.target.value)||0});});}}
              style={{width:"100%",background:"#0a0a14",border:"1px solid #2a2a3e",color:"#e8e8f0",borderRadius:8,padding:"6px 8px",fontSize:11,fontFamily:"inherit"}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:"#555",marginBottom:4,letterSpacing:.5}}>STATUS</div>
            <select value={ef.status} onChange={function(e){setEf(function(f){return Object.assign({},f,{status:e.target.value});});}}
              style={{width:"100%",background:"#0a0a14",border:"1px solid #2a2a3e",color:"#e8e8f0",borderRadius:8,padding:"6px 8px",fontSize:11,fontFamily:"inherit"}}>
              {["Active","Suspended","Expired","Trial"].map(function(s){return <option key={s}>{s}</option>;})}
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:"#555",marginBottom:4,letterSpacing:.5}}>EXPIRY</div>
            <input type="date" value={ef.expiry} onChange={function(e){setEf(function(f){return Object.assign({},f,{expiry:e.target.value});});}}
              style={{width:"100%",background:"#0a0a14",border:"1px solid #2a2a3e",color:"#e8e8f0",borderRadius:8,padding:"6px 8px",fontSize:11,fontFamily:"inherit"}}/>
          </div>
          <div style={{gridColumn:"1/-1",display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
            <button onClick={function(){setEf(function(f){return Object.assign({},f,{key:"HRCLOUD"+co2.id+"-"+new Date().getFullYear()});});}}
              style={{background:"#1e1e2e",border:"1px solid #2a2a3e",color:"#888",borderRadius:8,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
              Generate Key
            </button>
            <button onClick={function(){onSave(ef);}}
              style={{background:"#E5374A",border:"none",color:"#fff",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              Save License
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

  // ══════════════════════════════════════════════════════
  //  LOGIN SCREEN
  // ══════════════════════════════════════════════════════
  if(!authState.loggedIn){
    var selCoLic = licenses[activeCompany]||{};
    var selCoObj = companies.find(function(c){return c.id===activeCompany;})||companies[0]||{};
    var empCount  = employees.filter(function(e){return e.status!=="Terminated";}).length;
    var lGate     = checkLicense(selCoLic, empCount);

    return (
      <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0D1226 0%,#1a1a3e 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}input:focus{outline:2px solid #4F6EF7 !important;outline-offset:2px}`}</style>

        <div style={{width:"100%",maxWidth:900,padding:24,display:"flex",gap:32,alignItems:"stretch",animation:"fadeUp .4s ease"}}>
          {/* Left — branding */}
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 8px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
              <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#4F6EF7,#3451D1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#fff"}}>HR</div>
              <div>
                <div style={{fontSize:20,fontWeight:800,color:"#fff"}}>HRCloud Malaysia</div>
                <div style={{fontSize:11,color:"#666",marginTop:2}}>Enterprise HR & Payroll Platform</div>
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:28,fontWeight:800,color:"#fff",lineHeight:1.2,marginBottom:10}}>Welcome back.<br/><span style={{color:"#4F6EF7"}}>Sign in to continue.</span></div>
              <div style={{fontSize:12,color:"#555",lineHeight:1.6}}>
                Your credentials:<br/>
                <span style={{color:"#888"}}>• Username: Your Employee ID (e.g. E001)<br/>• Password: Last 6 digits of your IC number</span>
              </div>
            </div>
            {/* License status badge */}
            <div style={{background:lGate.ok?"#00E5A011":"#FF3B5C11",border:"1px solid "+(lGate.ok?"#00E5A033":"#FF3B5C33"),borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:10,fontWeight:700,color:lGate.ok?"#00E5A0":"#FF3B5C",marginBottom:2,letterSpacing:.5}}>LICENSE STATUS · {selCoObj.name||"Company"}</div>
              <div style={{fontSize:11,color:lGate.ok?"#aaa":"#FF3B5C"}}>
                {lGate.ok
                  ? (selCoLic.tier||"—")+" plan · "+empCount+"/"+(selCoLic.maxStaff||"—")+" staff · Expires "+selCoLic.expiry
                  : "⚠ "+lGate.msg}
              </div>
            </div>
            {/* Demo credentials */}
            <div style={{marginTop:16,background:"#ffffff08",border:"1px solid #ffffff11",borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:"#555",marginBottom:6,letterSpacing:.5}}>DEMO ACCOUNTS</div>
              {/* Super Admin */}
              <div style={{fontSize:9,color:"#444",marginBottom:4,letterSpacing:.5}}>COMPANY SUPER ADMIN</div>
              {INIT_COMPANIES.map(function(co2){return co2.superAdminId?(
                <div key={co2.id} style={{display:"flex",gap:8,fontSize:10,color:"#555",marginBottom:3,alignItems:"center"}}>
                  <span style={{color:"#FF9500",fontWeight:700,minWidth:36}}>{co2.superAdminId}</span>
                  <span style={{color:"#888",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{co2.name}</span>
                  <span style={{fontFamily:"monospace",color:"#666"}}>pw: {co2.superAdminPin}</span>
                </div>
              ):null;})}
              {/* Employees */}
              <div style={{fontSize:9,color:"#444",marginBottom:4,marginTop:8,letterSpacing:.5}}>EMPLOYEE LOGIN</div>
              {INIT_EMPLOYEES.map(function(e){return(
                <div key={e.id} style={{display:"flex",gap:8,fontSize:10,color:"#555",marginBottom:3,alignItems:"center"}}>
                  <span style={{color:"#4F6EF7",fontWeight:700,minWidth:36}}>{e.id}</span>
                  <span style={{color:"#888"}}>{e.preferredName||e.name}</span>
                  <span style={{marginLeft:"auto",fontFamily:"monospace",color:"#666"}}>pw: {empPassword(e)}</span>
                  <span style={{fontSize:9,color:"#444"}}>{e.role}</span>
                </div>
              );})}
            </div>
          </div>

          {/* Right — login card */}
          <div style={{width:360,background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:20,padding:28,display:"flex",flexDirection:"column",justifyContent:"center"}}>
            {/* Company selector */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,color:"#555",letterSpacing:.5,marginBottom:6}}>COMPANY</div>
              <select value={activeCompany} onChange={function(e){setActiveCompany(e.target.value);setLoginErr("");}}
                style={{width:"100%",background:"#0a0a14",border:"1px solid #2a2a3e",color:"#e8e8f0",borderRadius:10,padding:"9px 12px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>
                {companies.map(function(co2){return <option key={co2.id} value={co2.id}>{co2.name}</option>;})}
              </select>
            </div>

            {/* Login mode toggle */}
            <div style={{display:"flex",background:"#0a0a14",borderRadius:10,padding:3,marginBottom:20,border:"1px solid #1e1e30"}}>
              {[{id:"employee",label:"Employee"},{id:"superadmin",label:"Super Admin"},{id:"platform",label:"Platform"}].map(function(m){return(
                <button key={m.id} onClick={function(){setLoginMode(m.id);setLoginErr("");setLoginId("");setLoginPw("");}}
                  style={{flex:1,background:loginMode===m.id?"#1e1e2e":"none",border:"none",
                    color:loginMode===m.id?(m.id==="platform"?"#E5374A":m.id==="superadmin"?"#FF9500":"#e8e8f0"):"#444",
                    borderRadius:8,padding:"8px 4px",
                    fontSize:10,fontWeight:loginMode===m.id?700:400,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
                  {m.label}
                </button>
              );})}
            </div>

            {/* Fields */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"#555",letterSpacing:.5,marginBottom:6}}>{loginMode==="platform"?"PLATFORM ADMIN ID":loginMode==="superadmin"?"SUPER ADMIN ID":"EMPLOYEE ID"}</div>
              <input value={loginId} onChange={function(e){setLoginId(e.target.value);setLoginErr("");}}
                placeholder={loginMode==="platform"?"e.g. PA001":loginMode==="superadmin"?"e.g. SA001":"e.g. E001"}
                onKeyDown={function(e){if(e.key==="Enter")doLogin();}}
                style={{width:"100%",background:"#0a0a14",border:"1px solid "+(loginErr?"#FF3B5C44":"#2a2a3e"),color:"#e8e8f0",borderRadius:10,padding:"10px 14px",fontSize:13,fontFamily:"inherit"}}/>
            </div>
            <div style={{marginBottom:loginErr?10:18}}>
              <div style={{fontSize:10,color:"#555",letterSpacing:.5,marginBottom:6,display:"flex",justifyContent:"space-between"}}>
                <span>{loginMode==="platform"?"PLATFORM PIN":loginMode==="superadmin"?"SUPER ADMIN PASSWORD":"PASSWORD"}</span>
                <span style={{color:"#333",fontSize:9}}>{loginMode==="employee"?"Last 6 digits of IC":""}</span>
              </div>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} value={loginPw}
                  onChange={function(e){setLoginPw(e.target.value);setLoginErr("");}}
                  placeholder={loginMode==="platform"?"Platform PIN":loginMode==="superadmin"?"Company Super Admin password":"e.g. 141234"}
                  onKeyDown={function(e){if(e.key==="Enter")doLogin();}}
                  style={{width:"100%",background:"#0a0a14",border:"1px solid "+(loginErr?"#FF3B5C44":"#2a2a3e"),color:"#e8e8f0",borderRadius:10,padding:"10px 40px 10px 14px",fontSize:13,fontFamily:"inherit"}}/>
                <button onClick={function(){setShowPw(function(v){return !v;});}}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
                  {showPw?"hide":"show"}
                </button>
              </div>
            </div>
            {loginErr&&<div style={{fontSize:11,color:"#FF3B5C",marginBottom:12,padding:"8px 12px",background:"#FF3B5C11",borderRadius:8,border:"1px solid #FF3B5C33"}}>⚠ {loginErr}</div>}
            {/* API status link */}
            <div style={{textAlign:"center",marginBottom:10}}>
              <button onClick={function(){setShowApiModal(true);}}
                style={{background:"none",border:"none",color:apiConfig.enabled?"#00E5A0":"#555",
                  fontSize:10,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>
                {apiConfig.enabled?"🟢 API: "+apiConfig.baseUrl.replace(/https?:\/\//,"").slice(0,38)+"…":"🔌 Connect to backend API (optional)"}
              </button>
            </div>
            <button onClick={doLogin}
              style={{width:"100%",background:loginMode==="platform"?"linear-gradient(135deg,#E5374A,#B91C1C)":loginMode==="superadmin"?"linear-gradient(135deg,#D97706,#B45309)":"linear-gradient(135deg,#4F6EF7,#3451D1)",border:"none",color:"#fff",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px #4F6EF733",opacity:apiLoading?0.7:1}}>
              {apiLoading?"Signing in…":loginMode==="platform"?"Access Platform Console":loginMode==="superadmin"?"Sign In as Super Admin":"Sign In"}
            </button>

            <div style={{textAlign:"center",marginTop:20,fontSize:9,color:"#2a2a3e"}}>
              HRCloud Malaysia · v3.0 · Secured login system
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Platform admin → show platform panel
  if(authState.isPlatformAdmin){
    return <PlatformAdminPanel companies={companies} setCompanies={setCompanies} employees={employees} licenses={licenses} setLicenses={setLicenses} authState={authState} doLogout={doLogout}/>;
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      {showApiModal && <ApiConfigModal current={apiConfig} onSave={saveApiConfig} onClose={function(){setShowApiModal(false);}}/>}
      <ApiStatusBanner config={apiConfig} onConfigure={function(){setShowApiModal(true);}}/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #C8D0E8; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #4F6EF7; }
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .nav-btn { transition: all .15s ease !important; }
        .nav-btn:hover { background: #F0F4FF !important; color: #0D1226 !important; }
        .card-hover:hover { box-shadow: 0 4px 20px rgba(79,110,247,.12) !important; transform: translateY(-1px); transition: all .2s; }
        button:active { transform: scale(0.98); }
        input:focus, select:focus, textarea:focus { outline: 2px solid #4F6EF7 !important; outline-offset: 1px; }
      `}</style>

      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        {/* DARK SIDEBAR */}
        <div style={{width:232,background:C.sidebar,borderRight:"1px solid "+C.sidebarBorder,
          display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>

          {/* Logo */}
          <div style={{padding:"20px 16px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:36,height:36,borderRadius:10,
                background:"linear-gradient(135deg,#4F6EF7,#7C3AED)",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 4px 12px rgba(79,110,247,.3)"}}>
                <span style={{fontSize:18}}>💼</span>
              </div>
              <div>
                <div style={{color:"#0D1226",fontWeight:800,fontSize:15,letterSpacing:"-0.4px"}}>HRCloud</div>
                <div style={{color:C.accent,fontSize:9,fontWeight:700,letterSpacing:"0.08em"}}>MALAYSIA ENTERPRISE</div>
              </div>
            </div>

            {/* Company pill */}
            <div style={{background:C.surface,borderRadius:10,padding:"8px 12px",border:"1px solid "+C.border}}>
              <div style={{color:C.ts,fontSize:9,fontWeight:700,letterSpacing:"0.06em",marginBottom:3}}>ACTIVE COMPANY</div>
              <div style={{color:C.tp,fontSize:12,fontWeight:600}}>{co.tradeName||co.name||"--"}</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{flex:1,overflowY:"auto",padding:"4px 10px"}}>
            {NAV.map(function(mod) {
              var isActive = safeActive === mod.id;
              return (
                <button key={mod.id} onClick={function(){setActive(mod.id);}}
                  className="nav-btn"
                  style={{display:"flex",alignItems:"center",gap:10,width:"100%",
                    padding:"9px 12px",marginBottom:1,borderRadius:9,cursor:"pointer",
                    background:isActive?C.accentL:"transparent",
                    color:isActive?C.accent:C.ts,border:"none",
                    fontSize:13,fontWeight:isActive?700:500,
                    textAlign:"left",fontFamily:"inherit",
                    boxShadow:"none"}}>
                  <span style={{display:"flex",alignItems:"center",flexShrink:0,color:isActive?C.accent:"#1E3A8A"}}>{mod.icon}</span>
                  {mod.label}
                </button>              );
            })}
          </nav>

          {/* Logged-in user card + logout */}
          <div style={{padding:"12px 10px 16px",borderTop:"1px solid "+C.sidebarBorder}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:32,height:32,borderRadius:10,flexShrink:0,
                background:"linear-gradient(135deg,"+C.accent+","+C.accentD+")",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:13,fontWeight:800,color:"#fff"}}>
                {authState.emp?(authState.emp.preferredName||authState.emp.name||"?").charAt(0):"?"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:C.tp,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {authState.emp?authState.emp.preferredName||authState.emp.name:"User"}
                </div>
                <div style={{fontSize:9,color:C.ts,marginTop:1}}>
                  {authState.emp?authState.emp.empNo:""} · <span style={{color:C.accent}}>{authState.role||""}</span>
                </div>
              </div>
            </div>
            {/* License badge */}
            <div style={{background:licenseOk.ok?C.greenL:C.redL,border:"1px solid "+(licenseOk.ok?"#A7F3D0":"#FECDD3"),
              borderRadius:7,padding:"4px 8px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:9,fontWeight:700,color:licenseOk.ok?C.green:C.red}}>
                {licenseOk.ok?"✓ Licensed":"⚠ License Issue"}
              </span>
              <span style={{fontSize:8,color:C.ts}}>
                {employees.filter(function(e){return e.status!=="Terminated";}).length}/{currentLicense?currentLicense.maxStaff:"—"} staff
              </span>
            </div>
            {/* Role switcher — only for HR Manager / Super Admin */}
            {(authState.role==="HR Manager"||authState.role==="Super Admin")&&(
              <div style={{marginBottom:8}}>
                <div style={{color:C.ts,fontSize:9,fontWeight:700,letterSpacing:"0.06em",marginBottom:4}}>VIEW AS ROLE</div>
                <select value={effectiveRole} onChange={function(e){setViewRole(e.target.value); setActive("dashboard");}}
                  style={{width:"100%",fontSize:11,padding:"6px 8px",
                    background:C.surface,border:"1px solid "+C.border,
                    borderRadius:8,color:C.tp,fontFamily:"inherit",cursor:"pointer"}}>
                  {Object.keys(ROLE_PRESETS).map(function(r){return <option key={r} value={r}>{r}</option>;})}
                </select>
              </div>
            )}
            <button onClick={doLogout} style={{width:"100%",background:C.surface,border:"1px solid "+C.border,
              color:C.ts,borderRadius:8,padding:"7px",fontSize:11,fontWeight:600,
              cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              ⏻ Sign Out
            </button>
          </div>
        </div>

        {/* MAIN AREA */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Topbar */}
          <div style={{height:58,background:C.card,borderBottom:"1px solid "+C.border,
            display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"0 28px",flexShrink:0,
            boxShadow:"0 1px 0 "+C.border}}>
            <div style={S.rowG8}>
              <span style={{color:C.tm,fontSize:12,fontWeight:500}}>HRCloud</span>
              <span style={{color:C.tm,fontSize:14}}>›</span>
              <span style={{color:C.tp,fontWeight:700,fontSize:13,letterSpacing:"-0.2px"}}>
                {(NAV.find(function(m){return m.id===safeActive;})||{}).label||"Dashboard"}
              </span>
            </div>
            <div style={S.rowG12}>
              <div style={{background:C.accentL,border:"1px solid "+C.border,borderRadius:8,
                padding:"5px 12px",fontSize:12,fontWeight:600,color:C.accent}}>
                {new Date().toLocaleDateString("en-MY",{day:"numeric",month:"short",year:"numeric"})}
              </div>
              <div style={{background:licenseOk.ok?C.greenL:C.redL,border:"1px solid "+(licenseOk.ok?"#A7F3D0":"#FECDD3"),
                borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,color:licenseOk.ok?C.green:C.red}}>
                {licenseOk.ok?"✓ "+(currentLicense?currentLicense.tier:"")+" license":"⚠ License issue"}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,
                background:C.surface,borderRadius:10,padding:"5px 12px 5px 8px",
                border:"1px solid "+C.border}}>
                <Avatar name={authState.emp?authState.emp.name:"User"} size={26} />
                <div>
                  <div style={{color:C.tp,fontSize:12,fontWeight:600,lineHeight:1}}>
                    {authState.emp?authState.emp.preferredName||authState.emp.name:"User"}
                  </div>
                  <div style={{color:C.ts,fontSize:9,marginTop:2}}>{authState.role||""}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"28px",animation:"fadeIn .2s ease"}}>
            {activeModule === "dashboard"   && <Dashboard />}
            {activeModule === "employee"    && <EmployeeModule employees={employees} setEmployees={setEmployees} hrConfig={hrConfig} />}
            {activeModule === "empconfig"   && <EmployeeConfigModule config={hrConfig} setConfig={setHrConfig} leaveConfig={leaveConfig} setLeaveConfig={setLeaveConfig} payrollConfig={payrollConfig} setPayrollConfig={setPayrollConfig} />}
            {activeModule === "schedule"    && <ScheduleModule employees={employees} sched={gSched} setSched={setGSched} wh={gWh} setWh={setGWh} unifiedShift={gUnified} setUnifiedShift={setGUnified} schedMode={gSchedMode} setSchedMode={setGSchedMode} shiftPresets={gShiftPresets} setShiftPresets={setGShiftPresets} />}
            {activeModule === "payroll"     && <PayrollModule employees={employees} activeCompany={activeCompany} companies={companies} sched={gSched} wh={gWh} unifiedShift={gUnified} schedMode={gSchedMode} payrollConfig={payrollConfig} batches={globalBatches} setBatches={setGlobalBatches} />}
            {activeModule === "statutory"   && <StatutoryModule employees={employees} payrollConfig={payrollConfig} sched={gSched} wh={gWh} unifiedShift={gUnified} schedMode={gSchedMode} batches={globalBatches} />}
            {activeModule === "leave"       && <LeaveModule employees={employees} leaveConfig={leaveConfig} payrollConfig={payrollConfig} leaves={globalLeaves} setLeaves={setGlobalLeaves} />}
            {activeModule === "attendance"  && <AttendanceModule />}
            {activeModule === "claims"      && <ClaimsModule />}
            {activeModule === "ai"          && <AIModule />}
            {activeModule === "reports"     && <ReportsModule employees={employees} activeCompany={activeCompany} companies={companies} />}
            {activeModule === "bank"        && <BankModule />}
            {activeModule === "mobile"      && <MobilePreview employees={employees} globalLeaves={globalLeaves} setGlobalLeaves={setGlobalLeaves} globalBatches={globalBatches} payrollConfig={payrollConfig} leaveConfig={leaveConfig} companies={companies} activeCompany={activeCompany} gSched={gSched} gWh={gWh} gUnified={gUnified} gSchedMode={gSchedMode} />}
            {activeModule === "hierarchy"   && <HierarchyModule employees={employees} setEmployees={setEmployees} />}
            {activeModule === "permissions" && <PermissionsModule employees={employees} rolePerms={rolePerms} setRolePerms={setRolePerms} />}
            {activeModule === "myportal"    && <MyPortal viewAsEmployee={employees[0]} employees={employees} companyName={co.name||"TechCorp Sdn. Bhd."} sched={gSched} wh={gWh} unifiedShift={gUnified} schedMode={gSchedMode} shiftPresets={gShiftPresets} leaveConfig={leaveConfig} globalLeaves={globalLeaves} setGlobalLeaves={setGlobalLeaves} />}
            {activeModule === "setup"       && <SetupModule companies={companies} setCompanies={setCompanies} activeCompany={activeCompany} setActiveCompany={setActiveCompany} />}
            {activeModule === "import"     && <ImportModule employees={employees} setEmployees={setEmployees} setGlobalLeaves={setGlobalLeaves} setGlobalBatches={setGlobalBatches} setGWh={setGWh} />}
            {(activeModule !== "dashboard" && activeModule !== "employee" && activeModule !== "empconfig" && activeModule !== "schedule" && activeModule !== "payroll" && activeModule !== "statutory" && activeModule !== "leave" && activeModule !== "attendance" && activeModule !== "claims" && activeModule !== "ai" && activeModule !== "reports" && activeModule !== "bank" && activeModule !== "mobile" && activeModule !== "hierarchy" && activeModule !== "permissions" && activeModule !== "myportal" && activeModule !== "setup") && <Dashboard />}
          </div>
        </div>
      </div>
    </div>  );
}
