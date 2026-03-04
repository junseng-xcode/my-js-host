import { useState } from "react";

/* ─── LIGHT SKY-BLUE THEME ───────────────────────────────────── */
const C = {
  bg:       "#EBF6FC",
  surface:  "#D6EEF8",
  card:     "#FFFFFF",
  border:   "#B6D9EE",
  accent:   "#0EA5C9",
  accentL:  "#E0F4FB",
  accentD:  "#0369A1",
  green:    "#059669",
  greenL:   "#D1FAE5",
  amber:    "#D97706",
  amberL:   "#FEF3C7",
  red:      "#DC2626",
  redL:     "#FEE2E2",
  purple:   "#7C3AED",
  purpleL:  "#EDE9FE",
  tp:       "#0F172A",
  ts:       "#475569",
  tm:       "#CBD5E1",
};

/* ─── DATA ──────────────────────────────────────────────────────*/
const ALL_MODULES = [
  { id:"dashboard",        icon:"▦",  label:"Dashboard"     },
  { id:"setup",            icon:"⚙",  label:"Setup"         },
  { id:"employee",         icon:"◉",  label:"Employees"     },
  { id:"payroll",          icon:"＄", label:"Payroll"       },
  { id:"statutory",        icon:"◆",  label:"Statutory"     },
  { id:"leave",            icon:"◇",  label:"Leave"         },
  { id:"attendance",       icon:"⊕",  label:"Attendance"    },
  { id:"claims",           icon:"◈",  label:"Claims & OCR"  },
  { id:"ai",               icon:"◆",  label:"AI Engine"     },
  { id:"reports",          icon:"▤",  label:"Reports"       },
  { id:"bank",             icon:"⊞",  label:"Bank Files"    },
  { id:"mobile",           icon:"◈",  label:"Mobile App"    },
  { id:"hierarchy",        icon:"⊶",  label:"Org Hierarchy" },
  { id:"permissions",      icon:"◆",  label:"Permissions"   },
  { id:"myportal",         icon:"◉",  label:"My Portal"     },
  { id:"payroll-settings", icon:"⚙",  label:"EPF Settings"  },
];

const ROLE_PRESETS = {
  "Super Admin":  ALL_MODULES.map(m=>m.id),
  "HR Manager":   ["dashboard","setup","employee","payroll","statutory","leave","attendance","claims","ai","reports","bank","hierarchy","permissions","myportal","payroll-settings"],
  "Payroll Admin":["dashboard","employee","payroll","statutory","reports","bank","myportal","payroll-settings"],
  "Manager":      ["dashboard","leave","attendance","claims","reports","myportal"],
  "Staff":        ["myportal"],
};

const EPF_EE_OPTIONS = [
  {label:"11% — Standard (mandatory)", value:11},
  {label:"0% — Age ≥60 / Exempted",    value:0 },
  {label:"5.5% — Half-rate voluntary", value:5.5},
  {label:"Custom %",                   value:"custom"},
];
const EPF_ER_OPTIONS = [
  {label:"13% — Standard (wage ≤ RM5,000)", value:13},
  {label:"12% — Standard (wage > RM5,000)", value:12},
  {label:"6% — Employer (age ≥60)",         value:6 },
  {label:"Custom %",                         value:"custom"},
];
const resolveEpfRate = (r,c) => r==="custom" ? (parseFloat(c)||0) : (parseFloat(r)||0);
const calcEpfEe = e => parseFloat((e.basic*resolveEpfRate(e.epfEeRate,e.epfEeCustom)/100).toFixed(2));
const calcEpfEr = e => parseFloat((e.basic*resolveEpfRate(e.epfErRate,e.epfErCustom)/100).toFixed(2));

const EMPTY_EMP = {
  id:"", name:"", preferredName:"", gender:"Male", dob:"", nric:"", nationality:"Malaysian",
  religion:"", race:"", maritalStatus:"Single", spouseNric:"", spouseName:"", children:0,
  dept:"", grade:"", role:"Staff", position:"", employmentType:"Permanent",
  joinDate:"", confirmDate:"", resignDate:"", status:"Active",
  basic:0, epfEeRate:11, epfErRate:13, epfEeCustom:"", epfErCustom:"",
  socso:0, eis:0, pcb:0, risk:"low", age:0, managerId:null,
  // Contact
  phone:"", altPhone:"", personalEmail:"", workEmail:"",
  // Address
  addr1:"", addr2:"", city:"", postcode:"", state:"", country:"Malaysia",
  // Statutory
  epfNo:"", socsoCat:"1", socsoNo:"", eisNo:"", taxNo:"", taxBranch:"",
  // Bank
  bankName:"", bankAcc:"", bankHolder:"",
  // Emergency contact
  emerName:"", emerRel:"", emerPhone:"", emerPhone2:"",
  // Documents
  passportNo:"", passportExp:"", permitNo:"", permitExp:"",
};

const INIT_EMPLOYEES = [
  {...EMPTY_EMP,
   id:"E001",name:"Ahmad Farid bin Azman",preferredName:"Farid",gender:"Male",
   dob:"1985-01-01",nric:"850101-14-1234",nationality:"Malaysian",religion:"Islam",
   race:"Malay",maritalStatus:"Married",spouseName:"Nor Azura binti Razali",
   spouseNric:"870305-10-5678",children:2,
   dept:"Finance",grade:"G4",role:"HR Manager",position:"Senior Finance Manager",
   employmentType:"Permanent",joinDate:"2018-03-15",confirmDate:"2018-09-15",status:"Active",
   basic:5800,socso:29.75,eis:11.6,pcb:412,risk:"low",age:40,managerId:null,
   epfEeRate:11,epfErRate:12,epfEeCustom:"",epfErCustom:"",
   phone:"012-3456789",altPhone:"",personalEmail:"farid@gmail.com",workEmail:"farid@techcorp.com.my",
   addr1:"No. 12, Jalan Damai 3",addr2:"Taman Damai Perdana",city:"Kuala Lumpur",
   postcode:"56000",state:"W.P. Kuala Lumpur",country:"Malaysia",
   epfNo:"EP-12345601",socsoNo:"SO-12345601",socsoCat:"1",eisNo:"EI-12345601",
   taxNo:"SG-1234560000",taxBranch:"Lembaga Hasil Dalam Negeri, KL",
   bankName:"Maybank",bankAcc:"1122334455",bankHolder:"Ahmad Farid bin Azman",
   emerName:"Nor Azura binti Razali",emerRel:"Spouse",emerPhone:"013-9876543",emerPhone2:"",
  },
  {...EMPTY_EMP,
   id:"E002",name:"Siti Nurul Ain binti Hassan",preferredName:"Ain",gender:"Female",
   dob:"1990-02-15",nric:"900215-08-5678",nationality:"Malaysian",religion:"Islam",
   race:"Malay",maritalStatus:"Married",spouseName:"Mohd Izzat bin Yusof",
   spouseNric:"880720-14-3456",children:1,
   dept:"HR",grade:"G3",role:"HR Manager",position:"HR Executive",
   employmentType:"Permanent",joinDate:"2020-06-01",confirmDate:"2020-12-01",status:"Active",
   basic:4200,socso:21.45,eis:8.4,pcb:185,risk:"low",age:35,managerId:null,
   epfEeRate:11,epfErRate:13,epfEeCustom:"",epfErCustom:"",
   phone:"011-2345678",altPhone:"",personalEmail:"ain@gmail.com",workEmail:"ain@techcorp.com.my",
   addr1:"Unit 8-3, Residensi Harmoni",addr2:"Jalan Masjid India",city:"Kuala Lumpur",
   postcode:"50100",state:"W.P. Kuala Lumpur",country:"Malaysia",
   epfNo:"EP-12345602",socsoNo:"SO-12345602",socsoCat:"1",eisNo:"EI-12345602",
   taxNo:"SG-1234560001",taxBranch:"LHDN Wangsa Maju",
   bankName:"CIMB",bankAcc:"9988776655",bankHolder:"Siti Nurul Ain binti Hassan",
   emerName:"Hassan bin Mahmud",emerRel:"Father",emerPhone:"019-7654321",emerPhone2:"",
  },
  {...EMPTY_EMP,
   id:"E003",name:"Rajesh Kumar Nair",preferredName:"Rajesh",gender:"Male",
   dob:"1988-05-20",nric:"880520-10-9012",nationality:"Malaysian",religion:"Hindu",
   race:"Indian",maritalStatus:"Single",
   dept:"IT",grade:"G5",role:"Manager",position:"IT Manager",
   employmentType:"Permanent",joinDate:"2016-08-10",confirmDate:"2017-02-10",status:"Active",
   basic:7500,socso:29.75,eis:14.25,pcb:820,risk:"high",age:37,managerId:"E001",
   epfEeRate:11,epfErRate:12,epfEeCustom:"",epfErCustom:"",
   phone:"016-8887777",altPhone:"",personalEmail:"rajesh.kumar@gmail.com",workEmail:"rajesh@techcorp.com.my",
   addr1:"No. 45, Jalan SS15/4",addr2:"Subang Jaya",city:"Subang Jaya",
   postcode:"47500",state:"Selangor",country:"Malaysia",
   epfNo:"EP-12345603",socsoNo:"SO-12345603",socsoCat:"1",eisNo:"EI-12345603",
   taxNo:"SG-1234560002",taxBranch:"LHDN Petaling Jaya",
   bankName:"Maybank",bankAcc:"5544332211",bankHolder:"Rajesh Kumar Nair",
   emerName:"Kumar Nair",emerRel:"Father",emerPhone:"017-3334444",emerPhone2:"",
  },
  {...EMPTY_EMP,
   id:"E004",name:"Lim Wei Ting",preferredName:"Wei Ting",gender:"Female",
   dob:"1992-06-30",nric:"920630-14-3456",nationality:"Malaysian",religion:"Buddhism",
   race:"Chinese",maritalStatus:"Single",
   dept:"Sales",grade:"G3",role:"Staff",position:"Sales Executive",
   employmentType:"Permanent",joinDate:"2022-01-10",confirmDate:"2022-07-10",status:"Active",
   basic:4800,socso:25.05,eis:9.6,pcb:265,risk:"medium",age:33,managerId:"E003",
   epfEeRate:11,epfErRate:13,epfEeCustom:"",epfErCustom:"",
   phone:"018-5556666",altPhone:"",personalEmail:"weiting@gmail.com",workEmail:"weiting@techcorp.com.my",
   addr1:"A-12-5, The Horizon",addr2:"Jalan Kerinchi",city:"Bangsar South",
   postcode:"59200",state:"W.P. Kuala Lumpur",country:"Malaysia",
   epfNo:"EP-12345604",socsoNo:"SO-12345604",socsoCat:"1",eisNo:"EI-12345604",
   taxNo:"SG-1234560003",taxBranch:"LHDN Bangsar",
   bankName:"RHB",bankAcc:"2233445566",bankHolder:"Lim Wei Ting",
   emerName:"Lim Ah Kow",emerRel:"Father",emerPhone:"016-2223333",emerPhone2:"",
  },
  {...EMPTY_EMP,
   id:"E005",name:"Nurul Hidayah binti Razak",preferredName:"Hidayah",gender:"Female",
   dob:"1963-09-01",nric:"630901-03-7890",nationality:"Malaysian",religion:"Islam",
   race:"Malay",maritalStatus:"Widowed",children:3,
   dept:"Operations",grade:"G2",role:"Staff",position:"Operations Assistant",
   employmentType:"Permanent",joinDate:"2010-04-01",confirmDate:"2010-10-01",status:"Probation",
   basic:3200,socso:16.0,eis:6.4,pcb:64,risk:"low",age:61,managerId:"E003",
   epfEeRate:0,epfErRate:6,epfEeCustom:"",epfErCustom:"",
   phone:"014-7778888",altPhone:"",personalEmail:"hidayah@gmail.com",workEmail:"hidayah@techcorp.com.my",
   addr1:"No. 7, Lorong Maju 5",addr2:"Taman Maju",city:"Klang",
   postcode:"41000",state:"Selangor",country:"Malaysia",
   epfNo:"EP-12345605",socsoNo:"SO-12345605",socsoCat:"2",eisNo:"EI-12345605",
   taxNo:"SG-1234560004",taxBranch:"LHDN Shah Alam",
   bankName:"BSN",bankAcc:"6677889900",bankHolder:"Nurul Hidayah binti Razak",
   emerName:"Razak bin Abdullah",emerRel:"Son",emerPhone:"019-1112222",emerPhone2:"",
  },
];

const INIT_ROLE_PERMS = Object.fromEntries(
  Object.entries(ROLE_PRESETS).map(([r,m])=>[r,new Set(m)])
);

const kpis = [
  {label:"Total Headcount", value:"247",      sub:"+3 this month",      icon:"👥", color:C.accent,  bg:C.accentL},
  {label:"Monthly Payroll", value:"RM 1.24M", sub:"+2.1% vs last",      icon:"💰", color:C.green,   bg:C.greenL},
  {label:"Pending Leaves",  value:"18",       sub:"Awaiting approval",  icon:"📅", color:C.amber,   bg:C.amberL},
  {label:"Pending Claims",  value:"32",       sub:"RM 12,450 total",    icon:"🧾", color:C.purple,  bg:C.purpleL},
  {label:"AI Risk Alerts",  value:"3",        sub:"Needs urgent review", icon:"⚠️", color:C.red,     bg:C.redL},
  {label:"EPF Due In",      value:"5 days",   sub:"RM 136,400 payable", icon:"📋", color:C.amber,   bg:C.amberL},
];

const leaveData=[
  {id:"L001",name:"Ahmad Farid",   type:"Annual Leave",   from:"2025-06-10",to:"2025-06-12",days:3, status:"Pending", balance:12},
  {id:"L002",name:"Lim Wei Ting",  type:"Sick Leave",     from:"2025-06-08",to:"2025-06-08",days:1, status:"Approved",balance:14,mc:true},
  {id:"L003",name:"Rajesh Kumar",  type:"Emergency Leave",from:"2025-06-15",to:"2025-06-15",days:1, status:"Pending", balance:8},
  {id:"L004",name:"Siti Nurul Ain",type:"Maternity Leave",from:"2025-07-01",to:"2025-09-06",days:98,status:"Approved",balance:0},
];
const claimsData=[
  {id:"C001",name:"Ahmad Farid",  type:"Travel",       amount:320.50,date:"2025-06-05",status:"Pending", merchant:"Petronas TTDI",      ocr:true},
  {id:"C002",name:"Lim Wei Ting", type:"Medical",      amount:185.00,date:"2025-06-07",status:"Approved",merchant:"Klinik Kesihatan PJ",ocr:true},
  {id:"C003",name:"Rajesh Kumar", type:"Entertainment",amount:980.00,date:"2025-06-06",status:"Flagged", merchant:"Unknown",            ocr:false},
  {id:"C004",name:"Nurul Hidayah",type:"Mileage",      amount:156.80,date:"2025-06-08",status:"Pending", merchant:"Auto-calc",          ocr:false},
];
const attendance=[
  {name:"Ahmad Farid",   in:"08:52",out:null,   geo:true, ot:0,  status:"Present"},
  {name:"Lim Wei Ting",  in:"09:15",out:null,   geo:true, ot:0,  status:"Late"},
  {name:"Rajesh Kumar",  in:null,   out:null,   geo:false,ot:0,  status:"Absent"},
  {name:"Siti Nurul Ain",in:"08:30",out:"17:30",geo:true, ot:0.5,status:"Present"},
  {name:"Nurul Hidayah", in:"08:45",out:null,   geo:true, ot:0,  status:"Present"},
];
const aiAlerts=[
  {type:"Salary Anomaly",    sev:"HIGH",  desc:"Rajesh Kumar salary increased 35% — exceeds 30% threshold",      score:0.87},
  {type:"Duplicate Claim",   sev:"HIGH",  desc:"C003 duplicate receipt detected — same amount on 06/06 & 06/07", score:0.94},
  {type:"PCB Under-Deduction",sev:"MEDIUM",desc:"Lim Wei Ting projected annual tax gap: RM 1,240",              score:0.61},
];
const statutory=[
  {name:"EPF (KWSP)", ref:"Form A",     due:"2025-06-15",amount:"RM 136,400",status:"Pending",portal:"i-Akaun Majikan"},
  {name:"SOCSO",      ref:"Borang 8A",  due:"2025-06-15",amount:"RM 7,350",  status:"Pending",portal:"EzHASIL"},
  {name:"EIS",        ref:"Borang IS",  due:"2025-06-15",amount:"RM 2,470",  status:"Pending",portal:"SOCSO Portal"},
  {name:"PCB (MTD)",  ref:"CP39",       due:"2025-06-15",amount:"RM 98,800", status:"Pending",portal:"MyTax"},
  {name:"HRDF Levy",  ref:"Borang HRDF",due:"2025-06-30",amount:"RM 1,235",  status:"Pending",portal:"HRD Corp"},
];
const bankFiles=[
  {bank:"Maybank",format:"GIRO Fixed Width (.txt)",count:98,amount:"RM 498,200",status:"Ready"},
  {bank:"CIMB",   format:"BizChannel CSV",         count:87,amount:"RM 442,600",status:"Ready"},
  {bank:"RHB",    format:"Reflex Upload (.txt)",   count:62,amount:"RM 299,200",status:"Pending Approval"},
];
const PAYSLIPS=[
  {period:"June 2025", basic:5800,transport:200,bonus:0,   epf:638,socso:29.75,eis:11.6,pcb:412,net:4908.65,status:"Published"},
  {period:"May 2025",  basic:5800,transport:200,bonus:0,   epf:638,socso:29.75,eis:11.6,pcb:412,net:4908.65,status:"Published"},
  {period:"April 2025",basic:5800,transport:200,bonus:0,   epf:638,socso:29.75,eis:11.6,pcb:412,net:4908.65,status:"Published"},
  {period:"March 2025",basic:5800,transport:200,bonus:2900,epf:638,socso:29.75,eis:11.6,pcb:680,net:7740.65,status:"Published"},
  {period:"Feb 2025",  basic:5800,transport:200,bonus:0,   epf:638,socso:29.75,eis:11.6,pcb:412,net:4908.65,status:"Published"},
  {period:"Jan 2025",  basic:5800,transport:200,bonus:0,   epf:638,socso:29.75,eis:11.6,pcb:412,net:4908.65,status:"Published"},
];

function calcPCB(monthly,spouseRelief=false,children=0){
  const annual=monthly*12;
  const epfRelief=Math.min(monthly*0.11*12,4000);
  const chargeable=Math.max(0,annual-epfRelief-9000-(spouseRelief?4000:0)-(children*2000)-2500);
  const brackets=[[5000,0],[15000,0.01],[15000,0.03],[15000,0.06],[20000,0.11],[15000,0.19],[15000,0.25],[Infinity,0.28]];
  let tax=0,floor=5000;
  for(const[size,rate]of brackets){if(chargeable<=floor)break;tax+=Math.min(chargeable-floor,size)*rate;floor+=size;}
  return{chargeable:Math.round(chargeable),annualTax:Math.round(tax),monthlyPCB:Math.round(tax/12)};
}

/* ─── UI ATOMS ──────────────────────────────────────────────────*/
const inputStyle = {
  width:"100%",boxSizing:"border-box",
  background:"#fff",border:`1.5px solid ${C.border}`,
  borderRadius:8,padding:"9px 13px",color:C.tp,fontSize:13,
  outline:"none",fontFamily:"inherit",
};
const selectStyle = {
  background:"#fff",border:`1.5px solid ${C.border}`,color:C.tp,
  borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",
};

function Chip({text,c,bg}){
  return(
    <span style={{background:bg||(c+"18"),color:c,border:`1.5px solid ${c}33`,
      borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,letterSpacing:0.3,
      display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
      {text}
    </span>
  );
}
function StatusChip({s}){
  const map={
    Active:{c:C.green},Probation:{c:C.amber},Pending:{c:C.amber},
    Approved:{c:C.green},Rejected:{c:C.red},Flagged:{c:C.red},
    Present:{c:C.green},Late:{c:C.amber},Absent:{c:C.red},
    Ready:{c:C.green},"Pending Approval":{c:C.amber},
    HIGH:{c:C.red},MEDIUM:{c:C.amber},LOW:{c:C.green},
    Draft:{c:C.accent},Paid:{c:C.green},Published:{c:C.green},
    "Super Admin":{c:C.red},"HR Manager":{c:C.accent},
    "Payroll Admin":{c:C.purple},Manager:{c:C.amber},Staff:{c:C.ts},
  };
  const cfg=map[s]||{c:C.ts};
  return <Chip text={s} c={cfg.c}/>;
}

function Btn({children,c=C.accent,bg,onClick,sm,outline,disabled}){
  const bgColor=disabled?"#e2e8f0":outline?"transparent":(bg||(c+"15"));
  return(
    <button onClick={onClick} disabled={disabled} style={{
      background:bgColor,color:disabled?C.ts:c,
      border:`1.5px solid ${disabled?C.tm:c+"55"}`,borderRadius:8,
      padding:sm?"4px 12px":"8px 18px",fontSize:sm?11:13,fontWeight:600,
      cursor:disabled?"not-allowed":"pointer",letterSpacing:0.2,
      fontFamily:"inherit",whiteSpace:"nowrap",transition:"all .15s",
    }}>{children}</button>
  );
}

function Card({children,style={},noPad}){
  return(
    <div style={{
      background:C.card,border:`1.5px solid ${C.border}`,borderRadius:14,
      padding:noPad?0:20,boxShadow:"0 1px 4px rgba(14,165,201,.07)",
      ...style
    }}>{children}</div>
  );
}

function SectionHead({title,sub,action}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
      <div>
        <h2 style={{color:C.tp,fontSize:19,fontWeight:800,margin:0,letterSpacing:-.4}}>{title}</h2>
        {sub&&<p style={{color:C.ts,fontSize:13,margin:"4px 0 0"}}>{sub}</p>}
      </div>
      {action&&<div>{action}</div>}
    </div>
  );
}

function TH({children,right}){
  return(
    <th style={{color:C.ts,fontSize:11,letterSpacing:.7,padding:"10px 14px",
      textAlign:right?"right":"left",fontWeight:700,background:C.surface,
      borderBottom:`2px solid ${C.border}`,whiteSpace:"nowrap"}}>{children}</th>
  );
}
function TD({children,c,right,bold}){
  return(
    <td style={{color:c||C.tp,fontSize:13,padding:"11px 14px",
      borderBottom:`1px solid ${C.border}55`,textAlign:right?"right":"left",
      fontWeight:bold?700:400}}>{children}</td>
  );
}

function Toggle({on,onChange}){
  return(
    <div onClick={onChange} style={{
      width:40,height:22,borderRadius:11,
      background:on?C.accent:C.tm,cursor:"pointer",
      position:"relative",transition:"background .2s",flexShrink:0,
    }}>
      <div style={{width:16,height:16,borderRadius:"50%",background:"#fff",
        boxShadow:"0 1px 4px rgba(0,0,0,.25)",
        position:"absolute",top:3,left:on?21:3,transition:"left .2s"}}/>
    </div>
  );
}

function RiskBar({score}){
  const c=score>.7?C.red:score>.5?C.amber:C.green;
  return(
    <div style={{display:"flex",alignItems:"center",gap:7}}>
      <div style={{width:64,height:7,background:C.tm,borderRadius:4,overflow:"hidden"}}>
        <div style={{width:`${score*100}%`,height:"100%",background:c,borderRadius:4,
          transition:"width .4s"}}/>
      </div>
      <span style={{color:c,fontSize:11,fontWeight:700}}>{Math.round(score*100)}%</span>
    </div>
  );
}

function Avatar({name,size=34,bg=C.accentL,color=C.accent}){
  const initials=name.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
  return(
    <div style={{width:size,height:size,borderRadius:"50%",background:bg,
      color:color,fontWeight:800,fontSize:size*.38,
      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      {initials}
    </div>
  );
}

/* ─── LOGO ──────────────────────────────────────────────────────*/
function Logo({collapsed}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {/* Icon mark */}
      <div style={{position:"relative",width:32,height:32,flexShrink:0}}>
        <div style={{position:"absolute",inset:0,background:C.accent,borderRadius:8,
          transform:"rotate(10deg)",opacity:.18}}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
          justifyContent:"center",fontWeight:900,fontSize:17,color:C.accent,
          letterSpacing:-1}}>HR</div>
      </div>
      {!collapsed&&(
        <div>
          <div style={{fontSize:16,fontWeight:900,letterSpacing:-.5,lineHeight:1,color:C.tp}}>
            HR<span style={{color:C.accent}}>Cloud</span>
          </div>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,color:C.ts,marginTop:1}}>
            MALAYSIA · ENTERPRISE
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── MODULES ───────────────────────────────────────────────────*/

function Dashboard(){
  return(
    <div>
      <SectionHead title="Command Center"
        sub="HRCloud Malaysia · Multi-Tenant Enterprise Platform · June 2025"/>

      {/* KPI Grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:22}}>
        {kpis.map((k,i)=>(
          <Card key={i} style={{padding:"18px 20px",borderTop:`3px solid ${k.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{color:C.ts,fontSize:11,fontWeight:700,letterSpacing:.8,marginBottom:6}}>
                  {k.label.toUpperCase()}
                </div>
                <div style={{color:k.color,fontSize:26,fontWeight:900,letterSpacing:-1}}>
                  {k.value}
                </div>
                <div style={{color:C.ts,fontSize:12,marginTop:4}}>{k.sub}</div>
              </div>
              <div style={{width:40,height:40,borderRadius:10,background:k.bg,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                {k.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* AI Alerts */}
        <Card>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.red,flexShrink:0}}/>
            <span style={{color:C.tp,fontWeight:700,fontSize:14}}>AI Risk Alerts</span>
            <Chip text="3 active" c={C.red}/>
          </div>
          {aiAlerts.map((a,i)=>(
            <div key={i} style={{borderLeft:`3px solid ${a.sev==="HIGH"?C.red:C.amber}`,
              paddingLeft:12,marginBottom:14,paddingBottom:14,
              borderBottom:i<aiAlerts.length-1?`1px solid ${C.border}55`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{color:C.tp,fontWeight:700,fontSize:13}}>{a.type}</span>
                <StatusChip s={a.sev}/>
              </div>
              <div style={{color:C.ts,fontSize:12,marginBottom:6,lineHeight:1.5}}>{a.desc}</div>
              <RiskBar score={a.score}/>
            </div>
          ))}
        </Card>

        {/* Statutory Calendar */}
        <Card>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.amber,flexShrink:0}}/>
            <span style={{color:C.tp,fontWeight:700,fontSize:14}}>Statutory Calendar — June</span>
          </div>
          {statutory.map((s,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"10px 0",borderBottom:i<statutory.length-1?`1px solid ${C.border}55`:"none"}}>
              <div>
                <div style={{color:C.tp,fontSize:13,fontWeight:600}}>{s.name}</div>
                <div style={{color:C.ts,fontSize:11,marginTop:2}}>Due {s.due} · {s.amount}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:C.ts,fontSize:11}}>{s.portal}</span>
                <StatusChip s={s.status}/>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Payroll Snapshot */}
      <Card>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:C.accent,flexShrink:0}}/>
          <span style={{color:C.tp,fontWeight:700,fontSize:14}}>June 2025 Payroll Snapshot</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
          {[
            ["Gross Payroll","RM 1,240,000",C.tp,C.accentL],
            ["EPF Employer","RM 136,400",C.green,C.greenL],
            ["SOCSO + EIS","RM 9,820",C.accent,C.accentL],
            ["PCB (MTD)","RM 98,800",C.purple,C.purpleL],
            ["Net to Bank","RM 994,980",C.amber,C.amberL],
          ].map(([l,v,c,bg],i)=>(
            <div key={i} style={{background:bg,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
              <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:.7,marginBottom:6}}>
                {l.toUpperCase()}
              </div>
              <div style={{color:c,fontWeight:800,fontSize:15}}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EmployeeModule({employees, setEmployees}){
  const [sel,setSel]=useState(null);
  const [profileTab,setProfileTab]=useState("personal");
  const [showForm,setShowForm]=useState(false);
  const [editTarget,setEditTarget]=useState(null);
  const [form,setForm]=useState({});
  const [search,setSearch]=useState("");

  const emp=sel?employees.find(e=>e.id===sel):null;

  const openNew=()=>{
    setForm({...EMPTY_EMP, id:"E"+String(employees.length+1).padStart(3,"0")});
    setEditTarget(null);
    setShowForm(true);
    setSel(null);
  };
  const openEdit=(e)=>{
    setForm({...e});
    setEditTarget(e.id);
    setShowForm(true);
  };
  const saveForm=()=>{
    if(editTarget){
      setEmployees(prev=>prev.map(e=>e.id===editTarget?{...form}:e));
    } else {
      setEmployees(prev=>[...prev,{...form}]);
    }
    setShowForm(false);
    setEditTarget(null);
    setSel(form.id);
  };
  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));

  const STATES=["W.P. Kuala Lumpur","W.P. Putrajaya","W.P. Labuan","Selangor","Johor","Kedah","Kelantan","Melaka","Negeri Sembilan","Pahang","Perak","Perlis","Pulau Pinang","Sabah","Sarawak","Terengganu"];
  const BANKS=["Maybank","CIMB","Public Bank","RHB","Hong Leong Bank","AmBank","BSN","Bank Rakyat","Affin Bank","Alliance Bank","Bank Islam","OCBC","UOB","Standard Chartered","HSBC"];

  const filtered=employees.filter(e=>
    e.name.toLowerCase().includes(search.toLowerCase())||
    e.nric.includes(search)||
    e.dept.toLowerCase().includes(search.toLowerCase())||
    e.id.toLowerCase().includes(search.toLowerCase())
  );

  const FieldRow=({label,value,children})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"9px 0",borderBottom:`1px solid ${C.border}44`}}>
      <span style={{color:C.ts,fontSize:12,flexShrink:0,minWidth:140}}>{label}</span>
      {children||<span style={{color:C.tp,fontSize:13,fontWeight:600,textAlign:"right"}}>{value||"—"}</span>}
    </div>
  );

  const TabBtn=({id,label,icon})=>(
    <button onClick={()=>setProfileTab(id)} style={{
      background:profileTab===id?C.accentL:"transparent",
      color:profileTab===id?C.accent:C.ts,
      border:`1.5px solid ${profileTab===id?C.accent+"55":"transparent"}`,
      borderRadius:7,padding:"6px 12px",fontSize:11,fontWeight:600,
      cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
    }}>{icon} {label}</button>
  );

  const FLabel=({children})=>(
    <label style={{color:C.ts,fontSize:11,fontWeight:700,display:"block",
      marginBottom:5,letterSpacing:.5}}>{children}</label>
  );
  const FInput=({k,type="text",placeholder="",list})=>(
    <input type={type} value={form[k]||""} onChange={e=>setF(k,e.target.value)}
      placeholder={placeholder} list={list}
      style={{...inputStyle,marginBottom:0}}/>
  );
  const FSelect=({k,options})=>(
    <select value={form[k]||""} onChange={e=>setF(k,e.target.value)}
      style={{...selectStyle,width:"100%"}}>
      <option value="">— Select —</option>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  );
  const FGrid=({cols=2,children})=>(
    <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:12,marginBottom:4}}>
      {children}
    </div>
  );
  const FSec=({title,icon})=>(
    <div style={{color:C.accent,fontWeight:700,fontSize:13,
      margin:"20px 0 12px",paddingBottom:6,borderBottom:`2px solid ${C.accentL}`,
      display:"flex",alignItems:"center",gap:6}}>
      <span>{icon}</span>{title}
    </div>
  );

  return(
    <div>
      <SectionHead title="Employee Master"
        sub="Full personal, statutory & bank records for all staff"
        action={<Btn c={C.green} onClick={openNew}>+ Add Employee</Btn>}/>

      {/* ── ADD / EDIT FORM MODAL ───────────────────────────── */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.45)",
          zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",
          overflowY:"auto",padding:"40px 20px"}}>
          <div style={{background:C.card,borderRadius:18,width:"100%",maxWidth:820,
            boxShadow:"0 24px 80px rgba(14,165,201,.18)",padding:32,position:"relative"}}>

            {/* Modal header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              marginBottom:24,paddingBottom:16,borderBottom:`2px solid ${C.border}`}}>
              <div>
                <div style={{color:C.tp,fontWeight:800,fontSize:18}}>
                  {editTarget?"Edit Employee Profile":"New Employee"}
                </div>
                <div style={{color:C.ts,fontSize:12,marginTop:3}}>
                  {editTarget?`Editing: ${form.name}`:"Fill in all required fields"}
                </div>
              </div>
              <button onClick={()=>setShowForm(false)} style={{
                background:C.redL,border:"none",borderRadius:8,
                width:36,height:36,fontSize:18,cursor:"pointer",color:C.red,
                fontWeight:900,fontFamily:"inherit"}}>×</button>
            </div>

            {/* Personal Information */}
            <FSec title="Personal Information" icon="👤"/>
            <FGrid cols={3}>
              <div><FLabel>Full Name (as per IC) *</FLabel><FInput k="name"/></div>
              <div><FLabel>Preferred Name</FLabel><FInput k="preferredName"/></div>
              <div><FLabel>IC No (NRIC) *</FLabel><FInput k="nric" placeholder="YYMMDD-XX-XXXX"/></div>
            </FGrid>
            <FGrid cols={4}>
              <div><FLabel>Date of Birth</FLabel><FInput k="dob" type="date"/></div>
              <div><FLabel>Gender</FLabel><FSelect k="gender" options={["Male","Female"]}/></div>
              <div><FLabel>Nationality</FLabel><FSelect k="nationality" options={["Malaysian","Non-Malaysian","PR Holder","Expatriate"]}/></div>
              <div><FLabel>Religion</FLabel><FSelect k="religion" options={["Islam","Christianity","Buddhism","Hinduism","Others","None"]}/></div>
            </FGrid>
            <FGrid cols={4}>
              <div><FLabel>Race</FLabel><FSelect k="race" options={["Malay","Chinese","Indian","Bumiputera Sabah","Bumiputera Sarawak","Others"]}/></div>
              <div><FLabel>Marital Status</FLabel><FSelect k="maritalStatus" options={["Single","Married","Divorced","Widowed"]}/></div>
              {(form.maritalStatus==="Married")&&<div><FLabel>Spouse Name</FLabel><FInput k="spouseName"/></div>}
              {(form.maritalStatus==="Married")&&<div><FLabel>Spouse NRIC</FLabel><FInput k="spouseNric"/></div>}
              <div><FLabel>No. of Children</FLabel><FInput k="children" type="number"/></div>
            </FGrid>

            {/* Contact */}
            <FSec title="Contact Information" icon="📞"/>
            <FGrid cols={2}>
              <div><FLabel>Mobile Phone *</FLabel><FInput k="phone" placeholder="01X-XXXXXXX"/></div>
              <div><FLabel>Alternative Phone</FLabel><FInput k="altPhone"/></div>
              <div><FLabel>Personal Email</FLabel><FInput k="personalEmail" type="email"/></div>
              <div><FLabel>Work Email</FLabel><FInput k="workEmail" type="email"/></div>
            </FGrid>

            {/* Address */}
            <FSec title="Residential Address" icon="🏠"/>
            <FGrid cols={1}>
              <div><FLabel>Address Line 1</FLabel><FInput k="addr1" placeholder="No., Street name"/></div>
              <div><FLabel>Address Line 2</FLabel><FInput k="addr2" placeholder="Area, taman"/></div>
            </FGrid>
            <FGrid cols={4}>
              <div><FLabel>City</FLabel><FInput k="city"/></div>
              <div><FLabel>Postcode</FLabel><FInput k="postcode"/></div>
              <div><FLabel>State</FLabel><FSelect k="state" options={STATES}/></div>
              <div><FLabel>Country</FLabel><FInput k="country"/></div>
            </FGrid>

            {/* Employment */}
            <FSec title="Employment Details" icon="💼"/>
            <FGrid cols={3}>
              <div><FLabel>Employee ID</FLabel><FInput k="id"/></div>
              <div><FLabel>Department</FLabel><FSelect k="dept" options={["Finance","HR","IT","Sales","Operations","Marketing","Legal","Admin"]}/></div>
              <div><FLabel>Grade</FLabel><FSelect k="grade" options={["G1","G2","G3","G4","G5","G6","G7","G8","M1","M2"]}/></div>
              <div><FLabel>Position / Job Title</FLabel><FInput k="position"/></div>
              <div><FLabel>Role (System)</FLabel><FSelect k="role" options={["Staff","Manager","Payroll Admin","HR Manager","Super Admin"]}/></div>
              <div><FLabel>Employment Type</FLabel><FSelect k="employmentType" options={["Permanent","Contract","Internship","Part-time","Temporary"]}/></div>
            </FGrid>
            <FGrid cols={3}>
              <div><FLabel>Join Date</FLabel><FInput k="joinDate" type="date"/></div>
              <div><FLabel>Confirmation Date</FLabel><FInput k="confirmDate" type="date"/></div>
              <div><FLabel>Status</FLabel><FSelect k="status" options={["Active","Probation","Resigned","Terminated","Retired"]}/></div>
            </FGrid>
            <FGrid cols={2}>
              <div><FLabel>Basic Salary (RM)</FLabel><FInput k="basic" type="number"/></div>
            </FGrid>

            {/* Statutory */}
            <FSec title="Statutory Numbers" icon="📋"/>
            <FGrid cols={3}>
              <div><FLabel>EPF Number</FLabel><FInput k="epfNo" placeholder="EP-XXXXXXXX"/></div>
              <div><FLabel>SOCSO Number</FLabel><FInput k="socsoNo" placeholder="SO-XXXXXXXX"/></div>
              <div><FLabel>SOCSO Category</FLabel><FSelect k="socsoCat" options={["1 — Injury + Invalidity","2 — Injury Only (age 60+)"]}/></div>
              <div><FLabel>EIS Number</FLabel><FInput k="eisNo" placeholder="EI-XXXXXXXX"/></div>
              <div><FLabel>Tax File Number</FLabel><FInput k="taxNo" placeholder="SG-XXXXXXXXXX"/></div>
              <div><FLabel>Tax Branch (LHDN)</FLabel><FInput k="taxBranch"/></div>
            </FGrid>

            {/* Passport / Permit */}
            <FSec title="Passport / Work Permit" icon="🛂"/>
            <FGrid cols={2}>
              <div><FLabel>Passport No.</FLabel><FInput k="passportNo"/></div>
              <div><FLabel>Passport Expiry</FLabel><FInput k="passportExp" type="date"/></div>
              <div><FLabel>Work Permit / Visa No.</FLabel><FInput k="permitNo"/></div>
              <div><FLabel>Permit Expiry</FLabel><FInput k="permitExp" type="date"/></div>
            </FGrid>

            {/* Bank */}
            <FSec title="Bank Account" icon="🏦"/>
            <FGrid cols={3}>
              <div>
                <FLabel>Bank Name</FLabel>
                <select value={form.bankName||""} onChange={e=>setF("bankName",e.target.value)}
                  style={{...selectStyle,width:"100%"}}>
                  <option value="">— Select Bank —</option>
                  {BANKS.map(b=><option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div><FLabel>Account Number</FLabel><FInput k="bankAcc" placeholder="Account number"/></div>
              <div><FLabel>Account Holder Name</FLabel><FInput k="bankHolder"/></div>
            </FGrid>

            {/* Emergency Contact */}
            <FSec title="Emergency Contact" icon="🚨"/>
            <FGrid cols={2}>
              <div><FLabel>Contact Name</FLabel><FInput k="emerName"/></div>
              <div><FLabel>Relationship</FLabel><FSelect k="emerRel" options={["Spouse","Father","Mother","Sibling","Child","Friend","Others"]}/></div>
              <div><FLabel>Phone Number</FLabel><FInput k="emerPhone" placeholder="01X-XXXXXXX"/></div>
              <div><FLabel>Alternative Phone</FLabel><FInput k="emerPhone2"/></div>
            </FGrid>

            {/* Buttons */}
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,
              marginTop:28,paddingTop:16,borderTop:`1.5px solid ${C.border}`}}>
              <Btn c={C.ts} onClick={()=>setShowForm(false)}>Cancel</Btn>
              <Btn c={C.green} bg={C.greenL} onClick={saveForm}>
                {editTarget?"💾 Save Changes":"✅ Create Employee"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── EMPLOYEE LIST + PROFILE ─────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:sel?"340px 1fr":"1fr",gap:16}}>

        {/* List panel */}
        <div>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Search name, IC, dept, ID..."
            style={{...inputStyle,marginBottom:12}}/>
          <Card noPad style={{overflow:"hidden"}}>
            <div style={{padding:"10px 16px",background:C.surface,
              borderBottom:`1px solid ${C.border}`,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.tp,fontWeight:700,fontSize:13}}>
                All Employees ({filtered.length})
              </span>
            </div>
            <div style={{maxHeight:sel?"calc(100vh - 280px)":"500px",overflowY:"auto"}}>
              {filtered.map(e=>(
                <div key={e.id} onClick={()=>{setSel(sel===e.id?null:e.id);setProfileTab("personal");}}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                    cursor:"pointer",borderBottom:`1px solid ${C.border}55`,
                    background:sel===e.id?C.accentL:"transparent",
                    transition:"background .1s"}}>
                  <Avatar name={e.name} size={36}
                    bg={sel===e.id?C.accent+"33":C.accentL}
                    color={C.accent}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.tp,fontWeight:600,fontSize:13,
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {e.name}
                    </div>
                    <div style={{color:C.ts,fontSize:11,marginTop:2}}>
                      {e.id} · {e.dept} · {e.grade}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <StatusChip s={e.status}/>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Profile panel */}
        {emp&&(
          <div>
            {/* Profile header */}
            <Card style={{marginBottom:14,padding:"20px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <Avatar name={emp.name} size={60}/>
                  <div>
                    <div style={{color:C.tp,fontSize:17,fontWeight:800,letterSpacing:-.3}}>
                      {emp.name}
                    </div>
                    <div style={{color:C.ts,fontSize:13,marginTop:3}}>
                      {emp.position||emp.role} · {emp.dept} · {emp.grade}
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                      <StatusChip s={emp.status}/>
                      <Chip text={emp.employmentType} c={C.accent}/>
                      <Chip text={emp.id} c={C.ts}/>
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <Btn sm c={C.accent} onClick={()=>openEdit(emp)}>✏ Edit</Btn>
                  <Btn sm c={C.purple}>Payslip</Btn>
                  <Btn sm c={C.amber}>EA Form</Btn>
                </div>
              </div>
            </Card>

            {/* Profile tabs */}
            <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
              <TabBtn id="personal"   label="Personal"   icon="👤"/>
              <TabBtn id="contact"    label="Contact"    icon="📞"/>
              <TabBtn id="employment" label="Employment" icon="💼"/>
              <TabBtn id="statutory"  label="Statutory"  icon="📋"/>
              <TabBtn id="bank"       label="Bank"       icon="🏦"/>
              <TabBtn id="emergency"  label="Emergency"  icon="🚨"/>
            </div>

            <Card>
              {/* ─ PERSONAL ─ */}
              {profileTab==="personal"&&(
                <div>
                  <div style={{fontWeight:700,color:C.tp,fontSize:14,marginBottom:14}}>
                    Personal Information
                  </div>
                  <FieldRow label="Full Name">{
                    <span style={{color:C.tp,fontWeight:700,fontSize:13}}>{emp.name}</span>
                  }</FieldRow>
                  <FieldRow label="Preferred Name" value={emp.preferredName}/>
                  <FieldRow label="IC No (NRIC)" value={emp.nric}/>
                  <FieldRow label="Date of Birth" value={emp.dob}/>
                  <FieldRow label="Age" value={emp.age+" years old"}/>
                  <FieldRow label="Gender" value={emp.gender}/>
                  <FieldRow label="Nationality" value={emp.nationality}/>
                  <FieldRow label="Religion" value={emp.religion}/>
                  <FieldRow label="Race / Ethnicity" value={emp.race}/>
                  <FieldRow label="Marital Status" value={emp.maritalStatus}/>
                  {emp.spouseName&&<FieldRow label="Spouse Name" value={emp.spouseName}/>}
                  {emp.spouseNric&&<FieldRow label="Spouse NRIC" value={emp.spouseNric}/>}
                  <FieldRow label="No. of Children" value={emp.children||"0"}/>
                  {emp.passportNo&&<FieldRow label="Passport No." value={emp.passportNo}/>}
                  {emp.passportExp&&<FieldRow label="Passport Expiry" value={emp.passportExp}/>}
                  {emp.permitNo&&<FieldRow label="Work Permit No." value={emp.permitNo}/>}
                  {emp.permitExp&&<FieldRow label="Permit Expiry" value={emp.permitExp}/>}
                </div>
              )}

              {/* ─ CONTACT ─ */}
              {profileTab==="contact"&&(
                <div>
                  <div style={{fontWeight:700,color:C.tp,fontSize:14,marginBottom:14}}>
                    Contact Information
                  </div>
                  <FieldRow label="Mobile Phone" value={emp.phone}/>
                  <FieldRow label="Alternative Phone" value={emp.altPhone||"—"}/>
                  <FieldRow label="Personal Email" value={emp.personalEmail}/>
                  <FieldRow label="Work Email" value={emp.workEmail}/>
                  <div style={{marginTop:18,marginBottom:10,fontWeight:700,color:C.tp,fontSize:13}}>
                    Residential Address
                  </div>
                  <FieldRow label="Address Line 1" value={emp.addr1}/>
                  <FieldRow label="Address Line 2" value={emp.addr2||"—"}/>
                  <FieldRow label="City" value={emp.city}/>
                  <FieldRow label="Postcode" value={emp.postcode}/>
                  <FieldRow label="State" value={emp.state}/>
                  <FieldRow label="Country" value={emp.country}/>
                </div>
              )}

              {/* ─ EMPLOYMENT ─ */}
              {profileTab==="employment"&&(
                <div>
                  <div style={{fontWeight:700,color:C.tp,fontSize:14,marginBottom:14}}>
                    Employment Details
                  </div>
                  <FieldRow label="Employee ID" value={emp.id}/>
                  <FieldRow label="Position / Job Title" value={emp.position||emp.role}/>
                  <FieldRow label="Department" value={emp.dept}/>
                  <FieldRow label="Grade" value={emp.grade}/>
                  <FieldRow label="Role (System)" value={emp.role}/>
                  <FieldRow label="Employment Type" value={emp.employmentType}/>
                  <FieldRow label="Join Date" value={emp.joinDate}/>
                  <FieldRow label="Confirmation Date" value={emp.confirmDate}/>
                  {emp.resignDate&&<FieldRow label="Resignation Date" value={emp.resignDate}/>}
                  <FieldRow label="Status">{<StatusChip s={emp.status}/>}</FieldRow>
                  <div style={{marginTop:18,marginBottom:10,fontWeight:700,color:C.tp,fontSize:13}}>
                    Compensation
                  </div>
                  <FieldRow label="Basic Salary">
                    <span style={{color:C.green,fontWeight:800,fontSize:15}}>
                      RM {emp.basic.toLocaleString()}
                    </span>
                  </FieldRow>
                  <FieldRow label="EPF EE Rate" value={resolveEpfRate(emp.epfEeRate,emp.epfEeCustom)+"%"}/>
                  <FieldRow label="EPF ER Rate" value={resolveEpfRate(emp.epfErRate,emp.epfErCustom)+"%"}/>
                  <FieldRow label="PCB (MTD)" value={"RM "+emp.pcb}/>
                  <FieldRow label="Net Take-Home">
                    <span style={{color:C.accent,fontWeight:700}}>
                      RM {(emp.basic-calcEpfEe(emp)-emp.socso-emp.eis-emp.pcb).toFixed(2)}
                    </span>
                  </FieldRow>
                </div>
              )}

              {/* ─ STATUTORY ─ */}
              {profileTab==="statutory"&&(
                <div>
                  <div style={{fontWeight:700,color:C.tp,fontSize:14,marginBottom:14}}>
                    Statutory Registration Numbers
                  </div>
                  <FieldRow label="EPF No." value={emp.epfNo}/>
                  <FieldRow label="SOCSO No." value={emp.socsoNo}/>
                  <FieldRow label="SOCSO Category">
                    <Chip text={"Cat "+emp.socsoCat} c={C.accent}/>
                  </FieldRow>
                  <FieldRow label="EIS No." value={emp.eisNo}/>
                  <FieldRow label="Tax File No." value={emp.taxNo}/>
                  <FieldRow label="LHDN Branch" value={emp.taxBranch}/>
                  <div style={{marginTop:18,marginBottom:10,fontWeight:700,color:C.tp,fontSize:13}}>
                    Monthly Statutory Summary
                  </div>
                  {[
                    ["EPF Employee ("+resolveEpfRate(emp.epfEeRate,emp.epfEeCustom)+"%)", "RM "+calcEpfEe(emp).toFixed(2), C.green],
                    ["EPF Employer ("+resolveEpfRate(emp.epfErRate,emp.epfErCustom)+"%)", "RM "+calcEpfEr(emp).toFixed(2), C.amber],
                    ["SOCSO", "RM "+emp.socso.toFixed(2), C.accent],
                    ["EIS (0.2%)", "RM "+emp.eis.toFixed(2), C.accent],
                    ["PCB (MTD)", "RM "+emp.pcb, C.purple],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",
                      padding:"9px 0",borderBottom:`1px solid ${C.border}44`}}>
                      <span style={{color:C.ts,fontSize:12}}>{l}</span>
                      <span style={{color:c,fontWeight:700,fontSize:13}}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ─ BANK ─ */}
              {profileTab==="bank"&&(
                <div>
                  <div style={{fontWeight:700,color:C.tp,fontSize:14,marginBottom:14}}>
                    Bank Account Details
                  </div>
                  <div style={{background:C.accentL,border:`1.5px solid ${C.accent}44`,
                    borderRadius:12,padding:"18px 20px",marginBottom:16}}>
                    <div style={{color:C.ts,fontSize:11,fontWeight:700,marginBottom:8}}>PRIMARY ACCOUNT</div>
                    <div style={{color:C.tp,fontSize:20,fontWeight:900,letterSpacing:2,marginBottom:4}}>
                      {emp.bankName}
                    </div>
                    <div style={{color:C.ts,fontSize:14,letterSpacing:2,marginBottom:4}}>
                      {(emp.bankAcc||"").replace(/(.{4})/g,"$1 ").trim()}
                    </div>
                    <div style={{color:C.tp,fontSize:13,fontWeight:600}}>{emp.bankHolder}</div>
                  </div>
                  <FieldRow label="Bank Name" value={emp.bankName}/>
                  <FieldRow label="Account Number" value={emp.bankAcc}/>
                  <FieldRow label="Account Holder" value={emp.bankHolder}/>
                  <div style={{marginTop:16,padding:12,
                    background:C.amberL,borderRadius:10,
                    border:`1px solid ${C.amber}44`}}>
                    <div style={{color:C.amber,fontSize:11,fontWeight:700}}>
                      ℹ Salary is credited on the last working day of each month.
                    </div>
                  </div>
                </div>
              )}

              {/* ─ EMERGENCY ─ */}
              {profileTab==="emergency"&&(
                <div>
                  <div style={{fontWeight:700,color:C.tp,fontSize:14,marginBottom:14}}>
                    Emergency Contact
                  </div>
                  <div style={{background:C.redL,border:`1.5px solid ${C.red}33`,
                    borderRadius:12,padding:"16px 18px",marginBottom:16,
                    display:"flex",alignItems:"center",gap:14}}>
                    <span style={{fontSize:32}}>🚨</span>
                    <div>
                      <div style={{color:C.tp,fontSize:15,fontWeight:800}}>{emp.emerName}</div>
                      <div style={{color:C.ts,fontSize:12,marginTop:2}}>
                        {emp.emerRel} · {emp.emerPhone}
                      </div>
                    </div>
                  </div>
                  <FieldRow label="Contact Name" value={emp.emerName}/>
                  <FieldRow label="Relationship" value={emp.emerRel}/>
                  <FieldRow label="Phone Number" value={emp.emerPhone}/>
                  <FieldRow label="Alternative Phone" value={emp.emerPhone2||"—"}/>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!sel&&(
          <Card style={{display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",minHeight:320,display:sel?"none":"flex"}}>
            <div style={{fontSize:56,marginBottom:16}}>👤</div>
            <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:6}}>
              Select an employee
            </div>
            <div style={{color:C.ts,fontSize:13,textAlign:"center",maxWidth:260,lineHeight:1.6}}>
              Click any employee on the left to view their complete profile
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}


function PayrollModule(){
  const [salary,setSalary]=useState(5000);
  const [spouse,setSpouse]=useState(false);
  const [kids,setKids]=useState(0);
  const pcb=calcPCB(salary,spouse,kids);
  const epf=Math.round(salary*0.11);
  const epfEr=Math.round(salary*0.13);
  const socso=29.75;
  const eis=Math.round(salary*0.002);
  const net=salary-epf-socso-eis-pcb.monthlyPCB;
  return(
    <div>
      <SectionHead title="Payroll Engine"
        sub="Statutory calculation engine — EPF, SOCSO, EIS, PCB (MTD)"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <div style={{color:C.accent,fontWeight:700,fontSize:14,marginBottom:16,
            display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>🧮</span> Live PCB (MTD) Calculator
          </div>
          {[
            {label:"Monthly Basic Salary (RM)",val:salary,set:v=>setSalary(Number(v))},
            {label:"Children Count",val:kids,set:v=>setKids(Number(v))},
          ].map(({label,val,set})=>(
            <div key={label} style={{marginBottom:12}}>
              <label style={{color:C.ts,fontSize:11,display:"block",marginBottom:5,fontWeight:600}}>
                {label.toUpperCase()}
              </label>
              <input type="number" value={val} onChange={e=>set(e.target.value)} style={inputStyle}/>
            </div>
          ))}
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",
            marginBottom:16,padding:"10px 12px",background:C.accentL,borderRadius:8}}>
            <input type="checkbox" checked={spouse} onChange={e=>setSpouse(e.target.checked)}
              style={{width:16,height:16,accentColor:C.accent}}/>
            <span style={{color:C.tp,fontSize:13,fontWeight:600}}>Spouse Relief (RM 4,000)</span>
          </label>
          <div style={{background:C.surface,borderRadius:10,padding:16}}>
            {[
              ["Annual Gross",`RM ${(salary*12).toLocaleString()}`,C.tp],
              ["Chargeable Income",`RM ${pcb.chargeable.toLocaleString()}`,C.ts],
              ["Annual Tax",`RM ${pcb.annualTax.toLocaleString()}`,C.amber],
              ["Monthly PCB (MTD)",`RM ${pcb.monthlyPCB.toLocaleString()}`,C.red],
            ].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",
                padding:"8px 0",borderBottom:`1px solid ${C.border}55`}}>
                <span style={{color:C.ts,fontSize:13}}>{l}</span>
                <span style={{color:c,fontWeight:700,fontSize:13}}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{color:C.green,fontWeight:700,fontSize:14,marginBottom:16,
            display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>📊</span> Full Statutory Breakdown
          </div>
          <div style={{background:C.surface,borderRadius:10,padding:16,marginBottom:12}}>
            <div style={{color:C.ts,fontSize:11,fontWeight:700,letterSpacing:.7,marginBottom:10}}>
              EMPLOYEE DEDUCTIONS
            </div>
            {[
              ["EPF (11%)",`RM ${epf}`,C.green],
              ["SOCSO",`RM ${socso}`,C.accent],
              ["EIS (0.2%)",`RM ${eis}`,C.accent],
              ["PCB (MTD)",`RM ${pcb.monthlyPCB}`,C.red],
              ["Total Deduction",`RM ${(epf+socso+eis+pcb.monthlyPCB).toFixed(2)}`,C.amber],
            ].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",
                padding:"7px 0",borderBottom:`1px solid ${C.border}55`}}>
                <span style={{color:C.ts,fontSize:13}}>{l}</span>
                <span style={{color:c,fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{background:C.greenL,border:`1.5px solid ${C.green}44`,
            borderRadius:10,padding:"16px 18px",
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{color:C.ts,fontSize:11,fontWeight:700}}>NET TAKE-HOME</div>
              <div style={{color:C.ts,fontSize:11,marginTop:2}}>After all deductions</div>
            </div>
            <div style={{color:C.green,fontSize:22,fontWeight:900,letterSpacing:-1}}>
              RM {net.toLocaleString()}
            </div>
          </div>
        </Card>
      </div>
      {/* Payroll Batches */}
      <Card noPad style={{overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,
          display:"flex",justifyContent:"space-between",alignItems:"center",
          background:C.surface}}>
          <span style={{color:C.tp,fontWeight:700,fontSize:14}}>Payroll Batches</span>
          <Btn c={C.green}>▶ Run June 2025</Btn>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>
            <TH>Period</TH><TH right>Employees</TH><TH right>Gross</TH>
            <TH right>EPF (ER)</TH><TH right>SOCSO</TH><TH right>PCB</TH>
            <TH>Status</TH><TH>Actions</TH>
          </tr></thead>
          <tbody>
            {[
              {period:"June 2025",count:247,gross:1240000,epf:136400,socso:7350,pcb:98800,status:"Draft"},
              {period:"May 2025", count:244,gross:1214000,epf:133540,socso:7220,pcb:95200,status:"Paid"},
              {period:"Apr 2025", count:244,gross:1198000,epf:131780,socso:7220,pcb:93100,status:"Paid"},
            ].map((b,i)=>(
              <tr key={i}>
                <TD bold><span style={{color:C.accent}}>{b.period}</span></TD>
                <TD right>{b.count}</TD>
                <TD right c={C.tp}>RM {b.gross.toLocaleString()}</TD>
                <TD right c={C.green}>RM {b.epf.toLocaleString()}</TD>
                <TD right>RM {b.socso.toLocaleString()}</TD>
                <TD right c={C.purple}>RM {b.pcb.toLocaleString()}</TD>
                <TD><StatusChip s={b.status}/></TD>
                <TD><div style={{display:"flex",gap:6}}>
                  <Btn sm>Payslips</Btn><Btn sm c={C.amber}>Export</Btn>
                </div></TD>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PayrollSettingsModule({employees,setEmployees}){
  const [search,setSearch]=useState("");
  const [saved,setSaved]=useState({});
  const [bulkEe,setBulkEe]=useState("");
  const [bulkEr,setBulkEr]=useState("");
  const [showBulk,setShowBulk]=useState(false);

  const updateEmp=(id,field,val)=>{
    setEmployees(prev=>prev.map(e=>e.id===id?{...e,[field]:val}:e));
    setSaved(s=>({...s,[id]:false}));
  };
  const saveEmp=id=>setSaved(s=>({...s,[id]:true}));
  const applyBulk=()=>{
    if(!bulkEe&&!bulkEr)return;
    setEmployees(prev=>prev.map(e=>({
      ...e,
      ...(bulkEe!==""?{epfEeRate:bulkEe==="custom"?"custom":parseFloat(bulkEe)}:{}),
      ...(bulkEr!==""?{epfErRate:bulkEr==="custom"?"custom":parseFloat(bulkEr)}:{}),
    })));
    setSaved({});setShowBulk(false);setBulkEe("");setBulkEr("");
  };

  const filtered=employees.filter(e=>
    e.name.toLowerCase().includes(search.toLowerCase())||
    e.dept.toLowerCase().includes(search.toLowerCase())
  );
  const totalEe=employees.reduce((s,e)=>s+calcEpfEe(e),0);
  const totalEr=employees.reduce((s,e)=>s+calcEpfEr(e),0);

  const RateSelect=({empId,field,optionsArr,value,customField,customVal})=>{
    const isCustom=value==="custom";
    return(
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <select value={value}
          onChange={e=>{const v=e.target.value;updateEmp(empId,field,v==="custom"?"custom":parseFloat(v));}}
          style={{...selectStyle,minWidth:190}}>
          {optionsArr.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {isCustom&&(
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <input type="number" min="0" max="100" step="0.5" value={customVal}
              onChange={e=>updateEmp(empId,customField,e.target.value)}
              placeholder="e.g. 8"
              style={{...inputStyle,width:64,borderColor:C.amber,padding:"6px 8px"}}/>
            <span style={{color:C.ts,fontSize:11}}>%</span>
          </div>
        )}
      </div>
    );
  };

  return(
    <div>
      <SectionHead title="EPF Contribution Settings"
        sub="Configure employee & employer EPF rates per staff · KWSP-compliant"
        action={<Btn c={C.amber} onClick={()=>setShowBulk(!showBulk)}>⊞ Bulk Update</Btn>}/>

      {showBulk&&(
        <div style={{background:C.amberL,border:`1.5px solid ${C.amber}55`,
          borderRadius:12,padding:20,marginBottom:20}}>
          <div style={{color:C.amber,fontWeight:700,fontSize:13,marginBottom:14}}>
            ⊞ Bulk Apply EPF Rate to All Employees
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:14,alignItems:"end"}}>
            <div>
              <label style={{color:C.ts,fontSize:11,fontWeight:700,display:"block",
                marginBottom:6,letterSpacing:.6}}>EMPLOYEE RATE (ALL)</label>
              <select value={bulkEe} onChange={e=>setBulkEe(e.target.value)} style={{...selectStyle,width:"100%"}}>
                <option value="">— No change —</option>
                {EPF_EE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{color:C.ts,fontSize:11,fontWeight:700,display:"block",
                marginBottom:6,letterSpacing:.6}}>EMPLOYER RATE (ALL)</label>
              <select value={bulkEr} onChange={e=>setBulkEr(e.target.value)} style={{...selectStyle,width:"100%"}}>
                <option value="">— No change —</option>
                {EPF_ER_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn c={C.amber} onClick={applyBulk}>Apply to All</Btn>
              <Btn c={C.ts} onClick={()=>setShowBulk(false)}>Cancel</Btn>
            </div>
          </div>
          <p style={{color:C.ts,fontSize:11,marginTop:10}}>
            ⚠ This will overwrite individual settings. Employees with custom rates may need manual review.
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[
          ["Total Staff",employees.length+" employees",C.accent,C.accentL],
          ["EPF (EE) Monthly",`RM ${totalEe.toLocaleString("en",{minimumFractionDigits:2})}`,C.green,C.greenL],
          ["EPF (ER) Monthly",`RM ${totalEr.toLocaleString("en",{minimumFractionDigits:2})}`,C.amber,C.amberL],
          ["Total KWSP Liability",`RM ${(totalEe+totalEr).toLocaleString("en",{minimumFractionDigits:2})}`,C.purple,C.purpleL],
        ].map(([l,v,c,bg])=>(
          <Card key={l} style={{padding:"16px 18px",borderTop:`3px solid ${c}`}}>
            <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:.7,marginBottom:6}}>{l.toUpperCase()}</div>
            <div style={{color:c,fontSize:18,fontWeight:900}}>{v}</div>
          </Card>
        ))}
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="🔍  Search employee name or department..."
        style={{...inputStyle,marginBottom:16,paddingLeft:16}}/>

      <Card noPad style={{overflow:"hidden",marginBottom:16}}>
        <div style={{padding:"14px 20px",background:C.surface,borderBottom:`1px solid ${C.border}`,
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:C.tp,fontWeight:700,fontSize:14}}>EPF Contribution Rates per Employee</span>
          <span style={{color:C.ts,fontSize:12}}>{filtered.length} employee(s)</span>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>
            <TH>Employee</TH><TH>Age</TH><TH right>Basic</TH>
            <TH>Employee Rate</TH><TH right>EE Deduction</TH>
            <TH>Employer Rate</TH><TH right>ER Contribution</TH>
            <TH right>Total KWSP</TH><TH>Action</TH>
          </tr></thead>
          <tbody>
            {filtered.map(emp=>{
              const eeAmt=calcEpfEe(emp),erAmt=calcEpfEr(emp);
              const eeRate=resolveEpfRate(emp.epfEeRate,emp.epfEeCustom);
              const erRate=resolveEpfRate(emp.epfErRate,emp.epfErCustom);
              const isSaved=saved[emp.id];
              const warn=emp.age>=60&&emp.epfEeRate!==0;
              return(
                <tr key={emp.id} style={{background:warn?C.amberL+"55":"transparent"}}>
                  <TD>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <Avatar name={emp.name} size={30}/>
                      <div>
                        <div style={{color:C.tp,fontWeight:600,fontSize:13}}>{emp.name}</div>
                        <div style={{color:C.ts,fontSize:11}}>{emp.dept} · {emp.grade}</div>
                        {warn&&<div style={{color:C.amber,fontSize:10,marginTop:2}}>⚠ Age ≥60 — consider 0%</div>}
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:emp.age>=60?C.amber:C.tp,fontWeight:emp.age>=60?700:400}}>{emp.age}</span>
                      {emp.age>=60&&<Chip text="≥60" c={C.amber}/>}
                    </div>
                  </TD>
                  <TD right bold>RM {emp.basic.toLocaleString()}</TD>
                  <TD>
                    <RateSelect empId={emp.id} field="epfEeRate" optionsArr={EPF_EE_OPTIONS}
                      value={emp.epfEeRate} customField="epfEeCustom" customVal={emp.epfEeCustom}/>
                  </TD>
                  <TD right>
                    <div style={{color:eeAmt>0?C.green:C.ts,fontWeight:700}}>RM {eeAmt.toFixed(2)}</div>
                    <div style={{color:C.ts,fontSize:10}}>{eeRate}%</div>
                  </TD>
                  <TD>
                    <RateSelect empId={emp.id} field="epfErRate" optionsArr={EPF_ER_OPTIONS}
                      value={emp.epfErRate} customField="epfErCustom" customVal={emp.epfErCustom}/>
                  </TD>
                  <TD right>
                    <div style={{color:C.amber,fontWeight:700}}>RM {erAmt.toFixed(2)}</div>
                    <div style={{color:C.ts,fontSize:10}}>{erRate}%</div>
                  </TD>
                  <TD right>
                    <span style={{color:C.purple,fontWeight:800}}>RM {(eeAmt+erAmt).toFixed(2)}</span>
                  </TD>
                  <TD>
                    <Btn sm c={isSaved?C.green:C.accent} onClick={()=>saveEmp(emp.id)}>
                      {isSaved?"✓ Saved":"Save"}
                    </Btn>
                  </TD>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{background:C.surface}}>
              <td colSpan={4} style={{padding:"12px 14px",color:C.ts,fontSize:12,fontWeight:700,
                borderTop:`2px solid ${C.border}`}}>
                MONTHLY TOTALS ({employees.length} employees)
              </td>
              <td style={{padding:"12px 14px",textAlign:"right",borderTop:`2px solid ${C.border}`}}>
                <div style={{color:C.green,fontWeight:800}}>RM {totalEe.toFixed(2)}</div>
              </td>
              <td style={{borderTop:`2px solid ${C.border}`}}/>
              <td style={{padding:"12px 14px",textAlign:"right",borderTop:`2px solid ${C.border}`}}>
                <div style={{color:C.amber,fontWeight:800}}>RM {totalEr.toFixed(2)}</div>
              </td>
              <td style={{padding:"12px 14px",textAlign:"right",borderTop:`2px solid ${C.border}`}}>
                <div style={{color:C.purple,fontWeight:900,fontSize:14}}>RM {(totalEe+totalEr).toFixed(2)}</div>
              </td>
              <td style={{borderTop:`2px solid ${C.border}`}}/>
            </tr>
          </tfoot>
        </table>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>📋 KWSP Rate Reference</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>Category</TH><TH right>Employee</TH><TH right>Employer</TH></tr></thead>
            <tbody>
              {[
                ["Age <60, wage ≤ RM5,000","11%","13%"],
                ["Age <60, wage > RM5,000","11%","12%"],
                ["Age 60–75","0% (vol.)","6%"],
                ["Non-Malaysian citizen","11%","6.5%"],
                ["Voluntary extra","Custom","—"],
              ].map(([cat,ee,er],i)=>(
                <tr key={i}>
                  <TD c={C.ts}>{cat}</TD>
                  <TD right c={C.green}>{ee}</TD>
                  <TD right c={C.amber}>{er}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>⚠ Important Notes</div>
          {[
            "EPF must be remitted by the 15th of the following month.",
            "Employees aged 60+ are not required to contribute (0%) but employers must contribute 6%.",
            "Voluntary contributions above statutory minimum are allowed via Custom %.",
            "Non-citizens: employer rate is 6.5% regardless of age.",
            "Rate changes take effect from the NEXT payroll run after saving.",
          ].map((note,i)=>(
            <div key={i} style={{display:"flex",gap:10,padding:"9px 0",
              borderBottom:i<4?`1px solid ${C.border}55`:"none"}}>
              <span style={{color:C.accent,flexShrink:0,fontWeight:700}}>▸</span>
              <span style={{color:C.ts,fontSize:12,lineHeight:1.6}}>{note}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function HierarchyModule({employees,setEmployees}){
  const [editId,setEditId]=useState(null);
  const [newMgrId,setNewMgrId]=useState("");
  const saveManager=(empId)=>{
    setEmployees(prev=>prev.map(e=>e.id===empId?{...e,managerId:newMgrId||null}:e));
    setEditId(null);setNewMgrId("");
  };
  const roots=employees.filter(e=>!e.managerId);
  const getSubs=mgrId=>employees.filter(e=>e.managerId===mgrId);

  const NodeCard=({emp,depth=0})=>{
    const subs=getSubs(emp.id);
    const roleColors={"HR Manager":C.accent,"Manager":C.amber,"Staff":C.ts,"Super Admin":C.red};
    const rc=roleColors[emp.role]||C.ts;
    return(
      <div style={{marginLeft:depth*28}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:0,marginBottom:6}}>
          {depth>0&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",
              marginRight:8,paddingTop:16}}>
              <div style={{width:1,height:16,background:C.border}}/>
              <div style={{width:20,height:1,background:C.border}}/>
            </div>
          )}
          <div style={{flex:1,background:depth===0?C.accentL:C.card,
            border:`1.5px solid ${depth===0?C.accent+"66":C.border}`,
            borderRadius:12,padding:"12px 16px",
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <Avatar name={emp.name} size={36} bg={rc+"22"} color={rc}/>
              <div>
                <div style={{color:C.tp,fontSize:13,fontWeight:700}}>{emp.name}</div>
                <div style={{color:C.ts,fontSize:11,marginTop:2}}>{emp.dept} · {emp.grade}</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <StatusChip s={emp.role}/>
              {editId===emp.id?(
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <select value={newMgrId} onChange={e=>setNewMgrId(e.target.value)}
                    style={selectStyle}>
                    <option value="">No Manager (Root)</option>
                    {employees.filter(e=>e.id!==emp.id).map(e=>(
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <Btn sm c={C.green} onClick={()=>saveManager(emp.id)}>Save</Btn>
                  <Btn sm c={C.ts} onClick={()=>setEditId(null)}>Cancel</Btn>
                </div>
              ):(
                <Btn sm onClick={()=>{setEditId(emp.id);setNewMgrId(emp.managerId||"");}}>
                  Reassign
                </Btn>
              )}
            </div>
          </div>
        </div>
        {subs.map(sub=><NodeCard key={sub.id} emp={sub} depth={depth+1}/>)}
      </div>
    );
  };

  return(
    <div>
      <SectionHead title="Org Hierarchy & Reporting Lines"
        sub="Assign manager-subordinate relationships · approval chains auto-update"/>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:16}}>Reporting Tree</div>
          {roots.map(r=><NodeCard key={r.id} emp={r}/>)}
        </Card>
        <div>
          <Card style={{marginBottom:16}}>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>Direct Reports</div>
            {employees.filter(e=>getSubs(e.id).length>0).map(e=>{
              const subs=getSubs(e.id);
              return(
                <div key={e.id} style={{padding:"10px 0",
                  borderBottom:`1px solid ${C.border}55`}}>
                  <div style={{color:C.tp,fontSize:13,fontWeight:600}}>
                    {e.name.split(" ")[0]}
                  </div>
                  <div style={{color:C.ts,fontSize:11,marginTop:2}}>
                    {subs.length} direct report(s)
                  </div>
                  <div style={{color:C.accent,fontSize:11,marginTop:2}}>
                    {subs.map(s=>s.name.split(" ")[0]).join(", ")}
                  </div>
                </div>
              );
            })}
          </Card>
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:12}}>Approval Chain</div>
            {[
              ["Leave","Staff → Manager → HR"],
              ["Claims","Staff → Manager → Finance"],
              ["OT","Staff → Manager → HR"],
              ["Payroll","Payroll Admin → HR Manager"],
            ].map(([t,c])=>(
              <div key={t} style={{display:"flex",justifyContent:"space-between",
                padding:"8px 0",borderBottom:`1px solid ${C.border}55`}}>
                <span style={{color:C.ts,fontSize:12,fontWeight:600}}>{t}</span>
                <span style={{color:C.tp,fontSize:12}}>{c}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function PermissionsModule({employees,rolePerms,setRolePerms}){
  const [tab,setTab]=useState("roles");
  const [selRole,setSelRole]=useState("Staff");
  const [selEmp,setSelEmp]=useState(null);
  const [empPerms,setEmpPerms]=useState({});
  const roles=Object.keys(ROLE_PRESETS);

  const toggleRoleMod=(role,modId)=>{
    setRolePerms(prev=>{
      const s=new Set(prev[role]);
      s.has(modId)?s.delete(modId):s.add(modId);
      return{...prev,[role]:s};
    });
  };
  const getEffective=emp=>{
    const base=rolePerms[emp.role]||new Set();
    const ov=empPerms[emp.id]||{};
    const result=new Set(base);
    Object.entries(ov).forEach(([id,val])=>val?result.add(id):result.delete(id));
    return result;
  };
  const toggleEmpMod=(empId,modId)=>{
    const emp=employees.find(e=>e.id===empId);
    const base=rolePerms[emp.role]||new Set();
    const current=getEffective(emp);
    const hasIt=current.has(modId);
    const baseHas=base.has(modId);
    setEmpPerms(prev=>{
      const ov={...(prev[empId]||{})};
      if(hasIt&&baseHas)ov[modId]=false;
      else if(!hasIt&&!baseHas)ov[modId]=true;
      else delete ov[modId];
      return{...prev,[empId]:ov};
    });
  };
  const curEmp=selEmp?employees.find(e=>e.id===selEmp):null;

  return(
    <div>
      <SectionHead title="Access & Permissions"
        sub="Role-based module access · per-employee overrides"/>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {["roles","employees"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            background:tab===t?C.accentL:"transparent",
            color:tab===t?C.accent:C.ts,
            border:`1.5px solid ${tab===t?C.accent+"66":C.border}`,
            borderRadius:8,padding:"7px 18px",fontSize:13,fontWeight:600,
            cursor:"pointer",textTransform:"capitalize",fontFamily:"inherit",
          }}>{t==="roles"?"Role Permissions":"Employee Overrides"}</button>
        ))}
      </div>

      {tab==="roles"&&(
        <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:16}}>
          <Card style={{padding:8}}>
            {roles.map(r=>(
              <button key={r} onClick={()=>setSelRole(r)} style={{
                width:"100%",textAlign:"left",padding:"10px 12px",borderRadius:8,
                marginBottom:2,background:selRole===r?C.accentL:"transparent",
                color:selRole===r?C.accent:C.ts,
                border:`1.5px solid ${selRole===r?C.accent+"44":"transparent"}`,
                fontSize:12,fontWeight:selRole===r?700:400,cursor:"pointer",fontFamily:"inherit",
              }}>{r}</button>
            ))}
          </Card>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{color:C.tp,fontWeight:700,fontSize:14}}>{selRole} — Module Access</div>
              <div style={{display:"flex",gap:8}}>
                <Btn sm c={C.green}
                  onClick={()=>setRolePerms(p=>({...p,[selRole]:new Set(ALL_MODULES.map(m=>m.id))}))}>
                  Grant All
                </Btn>
                <Btn sm c={C.red}
                  onClick={()=>setRolePerms(p=>({...p,[selRole]:new Set()}))}>
                  Revoke All
                </Btn>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {ALL_MODULES.map(mod=>{
                const has=(rolePerms[selRole]||new Set()).has(mod.id);
                return(
                  <div key={mod.id} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    background:has?C.greenL:C.surface,
                    border:`1.5px solid ${has?C.green+"44":C.border}`,
                    borderRadius:10,padding:"10px 14px",
                    transition:"all .15s",
                  }}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:has?C.green:C.ts,fontSize:15}}>{mod.icon}</span>
                      <span style={{color:has?C.tp:C.ts,fontSize:12,fontWeight:has?600:400}}>
                        {mod.label}
                      </span>
                    </div>
                    <Toggle on={has} onChange={()=>toggleRoleMod(selRole,mod.id)}/>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab==="employees"&&(
        <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16}}>
          <Card style={{padding:8}}>
            {employees.map(emp=>(
              <button key={emp.id} onClick={()=>setSelEmp(emp.id)} style={{
                width:"100%",textAlign:"left",padding:"10px 12px",borderRadius:8,marginBottom:2,
                background:selEmp===emp.id?C.purpleL:"transparent",
                color:selEmp===emp.id?C.purple:C.ts,
                border:`1.5px solid ${selEmp===emp.id?C.purple+"44":"transparent"}`,
                fontSize:11,fontWeight:selEmp===emp.id?700:400,cursor:"pointer",fontFamily:"inherit",
              }}>
                <div style={{fontWeight:600,color:selEmp===emp.id?C.purple:C.tp}}>
                  {emp.name.split(" ")[0]+" "+emp.name.split(" ").slice(-1)}
                </div>
                <div style={{fontSize:10,color:C.ts,marginTop:1}}>{emp.role} · {emp.dept}</div>
              </button>
            ))}
          </Card>
          {curEmp?(
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div style={{color:C.tp,fontWeight:700,fontSize:14}}>{curEmp.name}</div>
                  <div style={{color:C.ts,fontSize:12,marginTop:2}}>
                    Base role: <span style={{color:C.accent,fontWeight:600}}>{curEmp.role}</span>
                    {" "}· Toggle below to override per-module
                  </div>
                </div>
                <Btn sm c={C.amber}
                  onClick={()=>setEmpPerms(p=>({...p,[curEmp.id]:{}}))}> Reset Overrides</Btn>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                {ALL_MODULES.map(mod=>{
                  const effective=getEffective(curEmp);
                  const has=effective.has(mod.id);
                  const baseHas=(rolePerms[curEmp.role]||new Set()).has(mod.id);
                  const isOverride=has!==baseHas;
                  return(
                    <div key={mod.id} style={{
                      display:"flex",justifyContent:"space-between",alignItems:"center",
                      background:isOverride?C.amberL:has?C.greenL:C.surface,
                      border:`1.5px solid ${isOverride?C.amber+"55":has?C.green+"44":C.border}`,
                      borderRadius:10,padding:"10px 14px",
                    }}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{color:has?C.green:C.ts,fontSize:15}}>{mod.icon}</span>
                        <div>
                          <div style={{color:has?C.tp:C.ts,fontSize:12,fontWeight:has?600:400}}>
                            {mod.label}
                          </div>
                          {isOverride&&(
                            <div style={{color:C.amber,fontSize:9,fontWeight:700,marginTop:1}}>
                              ★ Override active
                            </div>
                          )}
                        </div>
                      </div>
                      <Toggle on={has} onChange={()=>toggleEmpMod(curEmp.id,mod.id)}/>
                    </div>
                  );
                })}
              </div>
            </Card>
          ):(
            <Card style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:200}}>
              <div style={{color:C.ts,fontSize:14,textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:12}}>◉</div>
                Select an employee to configure individual module access
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function LeaveModule(){
  return(
    <div>
      <SectionHead title="Leave Management"
        sub="Malaysia Employment Act 1955 compliant leave engine"
        action={<Btn c={C.green}>+ New Application</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>
            Pending Applications
          </div>
          {leaveData.map((l,i)=>(
            <div key={i} style={{background:C.surface,borderRadius:10,padding:14,marginBottom:10,
              borderLeft:`3px solid ${l.status==="Approved"?C.green:l.status==="Pending"?C.amber:C.red}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Avatar name={l.name} size={28}/>
                  <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{l.name}</span>
                </div>
                <StatusChip s={l.status}/>
              </div>
              <div style={{color:C.accent,fontSize:13,fontWeight:600,marginBottom:4}}>
                {l.type} · {l.days} day(s)
              </div>
              <div style={{color:C.ts,fontSize:12}}>{l.from} → {l.to}</div>
              {l.mc&&<div style={{color:C.green,fontSize:11,marginTop:4,fontWeight:600}}>✓ MC Attached</div>}
              {l.status==="Pending"&&(
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <Btn sm c={C.green}>✓ Approve</Btn>
                  <Btn sm c={C.red}>✗ Reject</Btn>
                </div>
              )}
            </div>
          ))}
        </Card>
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>
            Leave Policy (Employment Act)
          </div>
          {[
            ["📅","Annual Leave","<2yr: 8d · 2–5yr: 12d · >5yr: 16d","Monthly accrual"],
            ["🏥","Sick Leave","<2yr: 14d · 2–5yr: 18d · >5yr: 22d","Entitlement"],
            ["🏨","Hospitalization","60 days including sick leave","Per event"],
            ["👶","Maternity Leave","98 days (Employment Act 2022)","Per event"],
            ["👨‍👦","Paternity Leave","7 days","Per event"],
            ["🕊","Compassionate","3 days","Per event"],
          ].map(([icon,type,rule,accrual])=>(
            <div key={type} style={{display:"flex",gap:12,padding:"10px 0",
              borderBottom:`1px solid ${C.border}55`}}>
              <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
              <div>
                <div style={{color:C.tp,fontSize:13,fontWeight:600}}>{type}</div>
                <div style={{color:C.ts,fontSize:12,marginTop:2}}>{rule}</div>
                <div style={{color:C.accent,fontSize:11,marginTop:1}}>Accrual: {accrual}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function AttendanceModule(){
  // ── Rich sample dataset (15 days, 5 employees) ──────────────
  const GEN = () => {
    const emps = [
      {id:"E001",name:"Ahmad Farid",  dept:"Finance"},
      {id:"E002",name:"Siti Nurul Ain",dept:"HR"},
      {id:"E003",name:"Rajesh Kumar", dept:"IT"},
      {id:"E004",name:"Lim Wei Ting", dept:"Sales"},
      {id:"E005",name:"Nurul Hidayah",dept:"Operations"},
    ];
    const rows = [];
    const statuses = ["Present","Present","Present","Present","Late","Absent"];
    for(let d=1;d<=15;d++){
      const date=`2025-06-${String(d).padStart(2,"0")}`;
      const dow=new Date(date).getDay();
      if(dow===0||dow===6) continue;
      emps.forEach(e=>{
        const st=statuses[Math.floor(Math.random()*statuses.length)];
        const inH=st==="Present"?8:st==="Late"?9+Math.floor(Math.random()*2):null;
        const inM=inH?String(Math.floor(Math.random()*59)).padStart(2,"0"):"";
        const outH=inH?(17+Math.floor(Math.random()*3)):null;
        const outM=outH?String(Math.floor(Math.random()*59)).padStart(2,"0"):"";
        const ot=outH&&outH>17?(outH-17+(parseInt(outM)/60)).toFixed(1):0;
        rows.push({
          id:`${e.id}-${date}`,empId:e.id,name:e.name,dept:e.dept,
          date,
          in:inH?`${String(inH).padStart(2,"0")}:${inM}`:null,
          out:outH?`${String(outH).padStart(2,"0")}:${outM}`:null,
          geo:st!=="Absent"&&Math.random()>0.1,
          ot:parseFloat(ot),
          status:st,
          source:Math.random()>0.3?"Thumbprint":"Manual",
          edited:false,
        });
      });
    }
    return rows;
  };

  const [records,setRecords]=useState(()=>GEN());
  const [view,setView]=useState("table"); // table | fullscreen | api
  const [filterDate,setFilterDate]=useState("");
  const [filterName,setFilterName]=useState("");
  const [filterDept,setFilterDept]=useState("");
  const [filterStatus,setFilterStatus]=useState("");
  const [filterSource,setFilterSource]=useState("");
  const [editRow,setEditRow]=useState(null);
  const [editIn,setEditIn]=useState("");
  const [editOut,setEditOut]=useState("");
  const [editReason,setEditReason]=useState("");
  const [sortCol,setSortCol]=useState("date");
  const [sortDir,setSortDir]=useState("desc");
  const [apiTab,setApiTab]=useState("overview");
  const [apiTest,setApiTest]=useState("");
  const [apiTestResult,setApiTestResult]=useState(null);
  const [apiKey] = useState("hrcloud_live_sk_7x9Kp2mNqR4wZvYt8dLsAeJu");
  const [syncLog,setSyncLog]=useState([
    {ts:"2025-06-09 08:47:22",device:"Thumbprint KL-HQ-01",action:"SYNC",count:42,status:"Success"},
    {ts:"2025-06-09 06:01:05",device:"Thumbprint KL-HQ-01",action:"HEARTBEAT",count:0,status:"Success"},
    {ts:"2025-06-08 17:45:11",device:"Thumbprint KL-HQ-01",action:"SYNC",count:38,status:"Success"},
    {ts:"2025-06-08 17:02:33",device:"Thumbprint PG-01",   action:"SYNC",count:14,status:"Failed"},
    {ts:"2025-06-07 17:30:01",device:"Thumbprint JB-01",   action:"SYNC",count:21,status:"Success"},
  ]);

  // ── Filtering + sorting ────────────────────────────────────
  const filtered = records.filter(r=>
    (!filterDate   || r.date===filterDate) &&
    (!filterName   || r.name.toLowerCase().includes(filterName.toLowerCase())) &&
    (!filterDept   || r.dept===filterDept) &&
    (!filterStatus || r.status===filterStatus) &&
    (!filterSource || r.source===filterSource)
  ).sort((a,b)=>{
    let va=a[sortCol]??"", vb=b[sortCol]??"";
    if(typeof va==="number") return sortDir==="asc"?va-vb:vb-va;
    return sortDir==="asc"?va.localeCompare(vb):vb.localeCompare(va);
  });

  const present=records.filter(r=>r.date==="2025-06-09"&&r.status==="Present").length;
  const late=records.filter(r=>r.date==="2025-06-09"&&r.status==="Late").length;
  const absent=records.filter(r=>r.date==="2025-06-09"&&r.status==="Absent").length;

  const depts=[...new Set(records.map(r=>r.dept))];

  const sort=(col)=>{
    if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc");
    else{setSortCol(col);setSortDir("asc");}
  };
  const SortIcon=({col})=>{
    if(sortCol!==col) return <span style={{color:C.tm,fontSize:10}}> ⇅</span>;
    return <span style={{color:C.accent,fontSize:10}}>{sortDir==="asc"?" ↑":" ↓"}</span>;
  };

  const saveEdit=(rowId)=>{
    setRecords(prev=>prev.map(r=>r.id===rowId?{
      ...r,
      in:editIn||r.in,
      out:editOut||r.out,
      editReason,
      edited:true,
      source:"Manual (Edited)",
    }:r));
    setEditRow(null);setEditIn("");setEditOut("");setEditReason("");
  };

  const simulateSync=()=>{
    const ts=new Date().toISOString().replace("T"," ").slice(0,19);
    const newEntry={ts,device:"Thumbprint KL-HQ-01",action:"SYNC",count:Math.floor(Math.random()*50)+10,status:"Success"};
    setSyncLog(prev=>[newEntry,...prev]);
    setApiTestResult({
      status:200,
      body:JSON.stringify({success:true,synced:newEntry.count,device:newEntry.device,timestamp:ts},null,2)
    });
  };

  const SH=({children,col,right})=>(
    <th onClick={()=>sort(col)} style={{
      color:C.ts,fontSize:11,letterSpacing:.7,padding:"10px 12px",
      textAlign:right?"right":"left",fontWeight:700,background:C.surface,
      borderBottom:`2px solid ${C.border}`,whiteSpace:"nowrap",cursor:"pointer",
      userSelect:"none",
    }}>
      {children}<SortIcon col={col}/>
    </th>
  );

  const isFullscreen = view==="fullscreen";

  const tableContent=(
    <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
      {/* ── Filters Bar ── */}
      <div style={{display:"flex",gap:8,padding:"12px 16px",background:C.surface,
        borderBottom:`1px solid ${C.border}`,flexWrap:"wrap",alignItems:"center"}}>
        <input value={filterDate} onChange={e=>setFilterDate(e.target.value)} type="date"
          style={{...selectStyle,fontSize:11,padding:"5px 8px"}}/>
        <input value={filterName} onChange={e=>setFilterName(e.target.value)}
          placeholder="🔍 Name" style={{...selectStyle,fontSize:11,padding:"5px 10px",width:150}}/>
        <select value={filterDept} onChange={e=>setFilterDept(e.target.value)}
          style={{...selectStyle,fontSize:11,padding:"5px 8px"}}>
          <option value="">All Departments</option>
          {depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          style={{...selectStyle,fontSize:11,padding:"5px 8px"}}>
          <option value="">All Statuses</option>
          {["Present","Late","Absent"].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterSource} onChange={e=>setFilterSource(e.target.value)}
          style={{...selectStyle,fontSize:11,padding:"5px 8px"}}>
          <option value="">All Sources</option>
          <option value="Thumbprint">Thumbprint</option>
          <option value="Manual">Manual</option>
          <option value="Manual (Edited)">Edited</option>
        </select>
        <span style={{color:C.ts,fontSize:11,marginLeft:4}}>
          Showing <strong style={{color:C.tp}}>{filtered.length}</strong> of {records.length} records
        </span>
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          <Btn sm c={C.ts} onClick={()=>{setFilterDate("");setFilterName("");setFilterDept("");setFilterStatus("");setFilterSource("");}}>
            Clear Filters
          </Btn>
          <Btn sm c={C.green}>↓ Export CSV</Btn>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{overflowY:"auto",flex:1}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{position:"sticky",top:0,zIndex:2}}>
            <tr>
              <SH col="date">Date</SH>
              <SH col="name">Employee</SH>
              <SH col="dept">Department</SH>
              <SH col="in">Check In</SH>
              <SH col="out">Check Out</SH>
              <SH col="ot" right>OT (hrs)</SH>
              <SH col="source">Source</SH>
              <SH col="geo">Geo</SH>
              <SH col="status">Status</SH>
              <th style={{color:C.ts,fontSize:11,letterSpacing:.7,padding:"10px 12px",
                background:C.surface,borderBottom:`2px solid ${C.border}`}}>Admin Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>(
              <tr key={r.id} style={{background:r.edited?C.amberL+"55":"transparent",
                borderBottom:`1px solid ${C.border}44`}}>
                <td style={{padding:"9px 12px",fontSize:12,color:C.ts,whiteSpace:"nowrap"}}>
                  {r.date}
                </td>
                <td style={{padding:"9px 12px",fontSize:13}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Avatar name={r.name} size={26}/>
                    <div>
                      <div style={{color:C.tp,fontWeight:600,lineHeight:1.2}}>{r.name}</div>
                      <div style={{color:C.ts,fontSize:10}}>{r.empId}</div>
                    </div>
                  </div>
                </td>
                <td style={{padding:"9px 12px",fontSize:12,color:C.ts}}>{r.dept}</td>
                <td style={{padding:"9px 12px",fontSize:13,fontWeight:600,
                  color:r.in?(r.status==="Late"?C.amber:C.green):C.red}}>
                  {editRow===r.id ? (
                    <input type="time" value={editIn} onChange={e=>setEditIn(e.target.value)}
                      style={{...selectStyle,fontSize:12,padding:"3px 6px",width:90}}/>
                  ) : (r.in||"—")}
                  {r.edited&&<span style={{color:C.amber,fontSize:9,display:"block"}}>edited</span>}
                </td>
                <td style={{padding:"9px 12px",fontSize:13,color:r.out?C.tp:C.ts}}>
                  {editRow===r.id ? (
                    <input type="time" value={editOut} onChange={e=>setEditOut(e.target.value)}
                      style={{...selectStyle,fontSize:12,padding:"3px 6px",width:90}}/>
                  ) : (r.out||"—")}
                </td>
                <td style={{padding:"9px 12px",fontSize:13,textAlign:"right",
                  color:r.ot>0?C.amber:C.ts,fontWeight:r.ot>0?700:400}}>
                  {r.ot>0?`+${r.ot}h`:"—"}
                </td>
                <td style={{padding:"9px 12px",fontSize:11}}>
                  <span style={{
                    color:r.source==="Thumbprint"?C.green:r.source.includes("Edited")?C.amber:C.ts,
                    fontWeight:600,
                  }}>
                    {r.source==="Thumbprint"?"👆 "+r.source:"✏ "+r.source}
                  </span>
                </td>
                <td style={{padding:"9px 12px"}}>
                  {r.geo
                    ? <Chip text="✓ GPS" c={C.green}/>
                    : <Chip text="✗" c={C.red}/>}
                </td>
                <td style={{padding:"9px 12px"}}><StatusChip s={r.status}/></td>
                <td style={{padding:"9px 12px"}}>
                  {editRow===r.id ? (
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      <input placeholder="Reason for edit..." value={editReason}
                        onChange={e=>setEditReason(e.target.value)}
                        style={{...selectStyle,fontSize:11,padding:"3px 8px",width:160}}/>
                      <div style={{display:"flex",gap:4}}>
                        <Btn sm c={C.green} onClick={()=>saveEdit(r.id)}>Save</Btn>
                        <Btn sm c={C.ts} onClick={()=>setEditRow(null)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <Btn sm c={C.accent} onClick={()=>{
                      setEditRow(r.id);
                      setEditIn(r.in||"");
                      setEditOut(r.out||"");
                      setEditReason(r.editReason||"");
                    }}>✏ Edit Time</Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&(
          <div style={{textAlign:"center",padding:48,color:C.ts}}>
            No records match the current filters.
          </div>
        )}
      </div>
    </div>
  );

  // ── FULLSCREEN OVERLAY ─────────────────────────────────────
  if(isFullscreen){
    return(
      <div style={{position:"fixed",inset:0,background:C.bg,zIndex:900,
        display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Fullscreen header */}
        <div style={{background:C.card,borderBottom:`1.5px solid ${C.border}`,
          padding:"14px 24px",display:"flex",alignItems:"center",
          justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{color:C.tp,fontWeight:800,fontSize:16}}>Attendance Register</div>
            <div style={{color:C.ts,fontSize:12,marginTop:2}}>
              {filtered.length} records · Full-screen mode
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{display:"flex",gap:10,marginRight:8}}>
              <Chip text={`✅ ${present} Present`} c={C.green}/>
              <Chip text={`⏰ ${late} Late`} c={C.amber}/>
              <Chip text={`❌ ${absent} Absent`} c={C.red}/>
            </div>
            <Btn c={C.green}>↓ Export CSV</Btn>
            <Btn c={C.red} onClick={()=>setView("table")}>✕ Exit Fullscreen</Btn>
          </div>
        </div>
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {tableContent}
        </div>
      </div>
    );
  }

  // ── NORMAL VIEW ────────────────────────────────────────────
  return(
    <div>
      <SectionHead title="Attendance Management"
        sub="Real-time records · column filters · admin time editing · thumbprint machine sync"/>

      {/* KPI strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20}}>
        {[
          ["✅ Present",present,C.green,C.greenL,"today"],
          ["⏰ Late",late,C.amber,C.amberL,"today"],
          ["❌ Absent",absent,C.red,C.redL,"today"],
          ["👆 Thumbprint",records.filter(r=>r.source==="Thumbprint").length,C.accent,C.accentL,"all records"],
          ["✏ Manual / Edited",records.filter(r=>r.source!=="Thumbprint").length,C.purple,C.purpleL,"all records"],
        ].map(([l,v,c,bg,sub])=>(
          <Card key={l} style={{padding:"14px 16px",borderTop:`3px solid ${c}`}}>
            <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:.7}}>{l.toUpperCase()}</div>
            <div style={{color:c,fontSize:22,fontWeight:900,margin:"4px 0"}}>{v}</div>
            <div style={{color:C.ts,fontSize:10}}>{sub}</div>
          </Card>
        ))}
      </div>

      {/* View tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["table","📋 Attendance Register"],["api","🔌 Thumbprint API / Sync"]].map(([id,label])=>(
          <button key={id} onClick={()=>setView(id)} style={{
            background:view===id?C.accentL:"transparent",
            color:view===id?C.accent:C.ts,
            border:`1.5px solid ${view===id?C.accent+"66":C.border}`,
            borderRadius:8,padding:"7px 18px",fontSize:13,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit",
          }}>{label}</button>
        ))}
      </div>

      {view==="table"&&(
        <Card noPad style={{overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"12px 16px",background:C.card,borderBottom:`1px solid ${C.border}`,
            display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <span style={{color:C.tp,fontWeight:700,fontSize:14}}>
              Attendance Register — June 2025
            </span>
            <Btn c={C.accent} onClick={()=>setView("fullscreen")}>⛶ Fullscreen</Btn>
          </div>
          <div style={{height:500,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {tableContent}
          </div>
        </Card>
      )}

      {view==="api"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {[["overview","Overview"],["endpoints","API Endpoints"],["test","Test Console"],["sync","Sync Logs"],["devices","Devices"]].map(([id,label])=>(
              <button key={id} onClick={()=>setApiTab(id)} style={{
                background:apiTab===id?C.accentL:"transparent",
                color:apiTab===id?C.accent:C.ts,
                border:`1.5px solid ${apiTab===id?C.accent+"66":C.border}`,
                borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:600,
                cursor:"pointer",fontFamily:"inherit",
              }}>{label}</button>
            ))}
          </div>

          {apiTab==="overview"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <Card>
                <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:16}}>
                  🔌 Thumbprint Machine Integration
                </div>
                <p style={{color:C.ts,fontSize:13,lineHeight:1.7,marginBottom:16}}>
                  HRCloud provides a REST API that allows any biometric / thumbprint device to push 
                  attendance records in real-time. Devices can also poll for employee rosters.
                </p>
                {[
                  ["Protocol","HTTPS REST (JSON)"],
                  ["Authentication","API Key (Bearer Token)"],
                  ["Push Interval","Real-time or batch (configurable)"],
                  ["Compatibility","ZKTeco, Suprema, Anviz, Nitgen, any HTTP-capable device"],
                  ["Sync Mode","Push (device → server) + Pull (server roster)"],
                  ["Encoding","UTF-8 JSON"],
                ].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",
                    padding:"8px 0",borderBottom:`1px solid ${C.border}44`,alignItems:"center"}}>
                    <span style={{color:C.ts,fontSize:12,fontWeight:600}}>{l}</span>
                    <span style={{color:C.tp,fontSize:12}}>{v}</span>
                  </div>
                ))}
              </Card>

              <div>
                <Card style={{marginBottom:14}}>
                  <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:12}}>
                    🔑 Your API Key
                  </div>
                  <div style={{background:"#1e2d3d",borderRadius:8,padding:"10px 14px",
                    fontFamily:"monospace",fontSize:11,color:"#7dd3fc",
                    wordBreak:"break-all",letterSpacing:.3,marginBottom:10}}>
                    {apiKey}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn sm c={C.accent} onClick={()=>navigator.clipboard?.writeText(apiKey)}>
                      📋 Copy Key
                    </Btn>
                    <Btn sm c={C.red}>🔄 Regenerate</Btn>
                  </div>
                  <p style={{color:C.ts,fontSize:11,marginTop:10}}>
                    ⚠ Keep this key secret. Include as <code>Authorization: Bearer {"{API_KEY}"}</code> in all device requests.
                  </p>
                </Card>
                <Card>
                  <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:12}}>
                    📡 Base URL
                  </div>
                  <div style={{background:"#1e2d3d",borderRadius:8,padding:"10px 14px",
                    fontFamily:"monospace",fontSize:12,color:"#7dd3fc"}}>
                    https://api.hrcloud.my/v1
                  </div>
                </Card>
              </div>
            </div>
          )}

          {apiTab==="endpoints"&&(
            <div>
              {[
                {
                  method:"POST",
                  path:"/attendance/sync",
                  color:C.green,
                  desc:"Push attendance records from thumbprint machine to HRCloud (batch or single).",
                  body:`{
  "device_id": "KL-HQ-01",
  "device_name": "Thumbprint KL Lobby",
  "records": [
    {
      "employee_id": "E001",
      "nric": "850101-14-1234",
      "type": "CHECK_IN",
      "timestamp": "2025-06-09T08:52:34+08:00",
      "method": "FINGERPRINT",
      "confidence": 0.98
    },
    {
      "employee_id": "E001",
      "nric": "850101-14-1234",
      "type": "CHECK_OUT",
      "timestamp": "2025-06-09T17:41:10+08:00",
      "method": "FINGERPRINT",
      "confidence": 0.97
    }
  ]
}`,
                  response:`{
  "success": true,
  "synced": 2,
  "failed": 0,
  "errors": [],
  "server_time": "2025-06-09T08:52:36+08:00"
}`,
                },
                {
                  method:"GET",
                  path:"/attendance/roster",
                  color:C.accent,
                  desc:"Pull employee roster for device registration. Returns active employees with their biometric IDs.",
                  body:null,
                  response:`{
  "total": 247,
  "employees": [
    {
      "id": "E001",
      "nric": "850101-14-1234",
      "name": "Ahmad Farid bin Azman",
      "fingerprint_enrolled": true,
      "face_enrolled": false,
      "active": true
    }
  ]
}`,
                },
                {
                  method:"POST",
                  path:"/attendance/heartbeat",
                  color:C.purple,
                  desc:"Device heartbeat check — confirms device is online and connected to HRCloud.",
                  body:`{
  "device_id": "KL-HQ-01",
  "status": "online",
  "firmware": "v2.4.1",
  "enrolled_count": 247
}`,
                  response:`{
  "acknowledged": true,
  "server_time": "2025-06-09T06:01:05+08:00",
  "roster_updated": false
}`,
                },
                {
                  method:"PUT",
                  path:"/attendance/{id}",
                  color:C.amber,
                  desc:"Admin manual time correction endpoint. Requires admin role. Creates an audit trail entry.",
                  body:`{
  "check_in":  "08:47:00",
  "check_out": "17:35:00",
  "reason":    "Device sync failure — manual correction",
  "admin_id":  "E001"
}`,
                  response:`{
  "success": true,
  "record_id": "E003-2025-06-09",
  "edited_by": "Ahmad Farid",
  "edited_at": "2025-06-09T11:22:18+08:00",
  "original_in": null,
  "original_out": null
}`,
                },
              ].map((ep,i)=>(
                <Card key={i} style={{marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{background:ep.color,color:"#fff",borderRadius:5,
                      padding:"3px 9px",fontSize:11,fontWeight:800,letterSpacing:.5}}>
                      {ep.method}
                    </span>
                    <code style={{color:C.tp,fontSize:13,fontWeight:700}}>{ep.path}</code>
                  </div>
                  <p style={{color:C.ts,fontSize:13,margin:"0 0 12px",lineHeight:1.6}}>{ep.desc}</p>
                  <div style={{display:"grid",gridTemplateColumns:ep.body?"1fr 1fr":"1fr",gap:12}}>
                    {ep.body&&(
                      <div>
                        <div style={{color:C.ts,fontSize:10,fontWeight:700,
                          letterSpacing:.6,marginBottom:6}}>REQUEST BODY</div>
                        <pre style={{background:"#1e2d3d",borderRadius:8,padding:12,
                          fontSize:11,color:"#7dd3fc",margin:0,overflow:"auto",
                          lineHeight:1.6,maxHeight:200}}>{ep.body}</pre>
                      </div>
                    )}
                    <div>
                      <div style={{color:C.ts,fontSize:10,fontWeight:700,
                        letterSpacing:.6,marginBottom:6}}>RESPONSE (200 OK)</div>
                      <pre style={{background:"#1e2d3d",borderRadius:8,padding:12,
                        fontSize:11,color:"#a3e635",margin:0,overflow:"auto",
                        lineHeight:1.6,maxHeight:200}}>{ep.response}</pre>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {apiTab==="test"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <Card>
                <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>
                  🧪 API Test Console
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{color:C.ts,fontSize:11,fontWeight:700,
                    display:"block",marginBottom:6}}>ENDPOINT</label>
                  <select value={apiTest} onChange={e=>setApiTest(e.target.value)}
                    style={{...selectStyle,width:"100%"}}>
                    <option value="">— Select endpoint —</option>
                    <option value="sync">POST /attendance/sync</option>
                    <option value="roster">GET /attendance/roster</option>
                    <option value="heartbeat">POST /attendance/heartbeat</option>
                  </select>
                </div>
                {apiTest&&(
                  <div style={{marginBottom:12}}>
                    <label style={{color:C.ts,fontSize:11,fontWeight:700,
                      display:"block",marginBottom:6}}>REQUEST PREVIEW</label>
                    <pre style={{background:"#1e2d3d",borderRadius:8,padding:12,
                      fontSize:11,color:"#7dd3fc",margin:0,maxHeight:200,overflow:"auto",
                      lineHeight:1.6}}>
{apiTest==="sync"?`POST https://api.hrcloud.my/v1/attendance/sync
Authorization: Bearer ${apiKey.slice(0,20)}...
Content-Type: application/json

{
  "device_id": "TEST-CONSOLE",
  "records": [{
    "employee_id": "E001",
    "type": "CHECK_IN",
    "timestamp": "${new Date().toISOString()}",
    "method": "FINGERPRINT"
  }]
}`:apiTest==="roster"?`GET https://api.hrcloud.my/v1/attendance/roster
Authorization: Bearer ${apiKey.slice(0,20)}...`:
`POST https://api.hrcloud.my/v1/attendance/heartbeat
Authorization: Bearer ${apiKey.slice(0,20)}...
Content-Type: application/json

{
  "device_id": "TEST-CONSOLE",
  "status": "online"
}`}
                    </pre>
                  </div>
                )}
                <Btn c={C.green} disabled={!apiTest} onClick={simulateSync}>
                  ▶ Send Test Request
                </Btn>
              </Card>
              <Card>
                <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>
                  📨 Response
                </div>
                {apiTestResult?(
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <Chip text={`HTTP ${apiTestResult.status}`} c={C.green}/>
                      <span style={{color:C.ts,fontSize:12}}>200 OK</span>
                    </div>
                    <pre style={{background:"#1e2d3d",borderRadius:8,padding:14,
                      fontSize:12,color:"#a3e635",margin:0,lineHeight:1.8}}>
                      {apiTestResult.body}
                    </pre>
                  </div>
                ):(
                  <div style={{color:C.ts,fontSize:13,textAlign:"center",padding:40}}>
                    Select an endpoint and click Send to test
                  </div>
                )}
              </Card>
            </div>
          )}

          {apiTab==="sync"&&(
            <div>
              <Card style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"center",marginBottom:14}}>
                  <div style={{color:C.tp,fontWeight:700,fontSize:14}}>
                    Device Sync Log
                  </div>
                  <Btn c={C.green} onClick={simulateSync}>▶ Simulate Sync</Btn>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <TH>Timestamp</TH><TH>Device</TH><TH>Action</TH>
                    <TH right>Records</TH><TH>Status</TH>
                  </tr></thead>
                  <tbody>
                    {syncLog.map((l,i)=>(
                      <tr key={i}>
                        <td style={{padding:"9px 14px",fontSize:12,color:C.ts,
                          fontFamily:"monospace",borderBottom:`1px solid ${C.border}44`}}>
                          {l.ts}
                        </td>
                        <TD>{l.device}</TD>
                        <TD c={l.action==="SYNC"?C.accent:C.ts}>{l.action}</TD>
                        <TD right bold>{l.count}</TD>
                        <TD><Chip text={l.status}
                          c={l.status==="Success"?C.green:C.red}/></TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {apiTab==="devices"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {[
                {id:"KL-HQ-01",name:"Thumbprint KL Lobby",loc:"KL HQ · Ground Floor",
                  status:"Online",last:"2025-06-09 08:52",enrolled:247,fw:"v2.4.1",ip:"192.168.1.101"},
                {id:"PG-01",name:"Thumbprint Penang",loc:"Penang · Level 2",
                  status:"Offline",last:"2025-06-08 17:02",enrolled:42,fw:"v2.3.8",ip:"10.10.2.55"},
                {id:"JB-01",name:"Thumbprint JB",loc:"JB Office · Entrance",
                  status:"Online",last:"2025-06-09 08:44",enrolled:61,fw:"v2.4.1",ip:"172.16.1.20"},
              ].map(d=>(
                <Card key={d.id} style={{borderTop:`3px solid ${d.status==="Online"?C.green:C.red}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"flex-start",marginBottom:14}}>
                    <span style={{fontSize:32}}>👆</span>
                    <Chip text={d.status} c={d.status==="Online"?C.green:C.red}/>
                  </div>
                  <div style={{color:C.tp,fontSize:14,fontWeight:700,marginBottom:2}}>{d.name}</div>
                  <div style={{color:C.ts,fontSize:12,marginBottom:12}}>{d.loc}</div>
                  {[["Device ID",d.id],["IP Address",d.ip],["Firmware",d.fw],
                    ["Enrolled",d.enrolled+" employees"],["Last Sync",d.last]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",
                      padding:"6px 0",borderBottom:`1px solid ${C.border}44`,fontSize:12}}>
                      <span style={{color:C.ts}}>{l}</span>
                      <span style={{color:C.tp,fontWeight:600}}>{v}</span>
                    </div>
                  ))}
                  <div style={{marginTop:12,display:"flex",gap:8}}>
                    <Btn sm c={C.accent}>Ping Device</Btn>
                    <Btn sm c={C.amber}>Force Sync</Btn>
                  </div>
                </Card>
              ))}
              <Card style={{border:`2px dashed ${C.border}`,background:"transparent",
                display:"flex",flexDirection:"column",alignItems:"center",
                justifyContent:"center",minHeight:200,cursor:"pointer"}}>
                <div style={{fontSize:36,marginBottom:12}}>➕</div>
                <div style={{color:C.accent,fontWeight:700,fontSize:14}}>Register New Device</div>
                <div style={{color:C.ts,fontSize:12,marginTop:4}}>Connect a thumbprint machine</div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function ClaimsModule(){
  return(
    <div>
      <SectionHead title="Claims & Expense Management"
        sub="OCR-powered receipt scanning · AI duplicate detection · multi-level approval"
        action={<Btn c={C.green}>+ Submit Claim</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <Card noPad style={{overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>Ref</TH><TH>Employee</TH><TH>Type</TH><TH right>Amount</TH><TH>Merchant</TH><TH>OCR</TH><TH>Status</TH><TH>Action</TH></tr></thead>
            <tbody>
              {claimsData.map(c=>(
                <tr key={c.id}>
                  <TD c={C.accent} bold>{c.id}</TD>
                  <TD>{c.name}</TD>
                  <TD c={C.ts}>{c.type}</TD>
                  <TD right bold>RM {c.amount.toFixed(2)}</TD>
                  <TD c={C.ts}>{c.merchant}</TD>
                  <TD>{c.ocr?<Chip text="✓ OCR" c={C.green}/>:<Chip text="Manual" c={C.ts}/>}</TD>
                  <TD><StatusChip s={c.status}/></TD>
                  <TD>{c.status==="Pending"&&(
                    <div style={{display:"flex",gap:4}}>
                      <Btn sm c={C.green}>✓</Btn>
                      <Btn sm c={C.red}>✗</Btn>
                    </div>
                  )}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>📷 OCR Receipt Scanner</div>
          <div style={{background:C.surface,border:`2px dashed ${C.border}`,
            borderRadius:12,padding:28,textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:40,marginBottom:8}}>📷</div>
            <div style={{color:C.ts,fontSize:13}}>Snap or upload receipt</div>
            <div style={{color:C.ts,fontSize:11,marginTop:4}}>Auto-extract merchant, date & amount</div>
            <div style={{marginTop:14}}><Btn c={C.accent}>Upload Receipt</Btn></div>
          </div>
          <div style={{background:C.greenL,border:`1.5px solid ${C.green}44`,borderRadius:10,padding:14}}>
            <div style={{color:C.green,fontSize:12,fontWeight:700,marginBottom:8}}>✓ Last OCR Result</div>
            {[["Merchant","Klinik Kesihatan PJ"],["Date","07 Jun 2025"],["Amount","RM 185.00"],["Category","Medical"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",
                fontSize:12,padding:"4px 0",borderBottom:`1px solid ${C.border}55`}}>
                <span style={{color:C.ts}}>{l}</span>
                <span style={{color:C.tp,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatutoryModule(){
  return(
    <div>
      <SectionHead title="Statutory Compliance"
        sub="EPF, SOCSO, EIS, PCB, HRDF — auto-submission files for Malaysia portals"
        action={<Btn c={C.amber}>Generate All Files</Btn>}/>
      <Card noPad style={{overflow:"hidden",marginBottom:16}}>
        <div style={{padding:"14px 20px",background:C.surface,borderBottom:`1px solid ${C.border}`}}>
          <span style={{color:C.tp,fontWeight:700,fontSize:14}}>June 2025 Statutory Schedule</span>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>Statutory</TH><TH>Reference</TH><TH>Due Date</TH><TH right>Amount</TH><TH>Portal</TH><TH>Status</TH><TH>File</TH></tr></thead>
          <tbody>
            {statutory.map((s,i)=>(
              <tr key={i}>
                <TD bold>{s.name}</TD>
                <TD c={C.ts}>{s.ref}</TD>
                <TD c={C.amber}>{s.due}</TD>
                <TD right bold>{s.amount}</TD>
                <TD c={C.accent}>{s.portal}</TD>
                <TD><StatusChip s={s.status}/></TD>
                <TD><Btn sm>Export</Btn></TD>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {[
          {title:"EPF Rate Table",items:["Employee: 11%","Employer: 13% (age <60, ≤RM5k)","Employer: 12% (age <60, >RM5k)","Employer: 6% (age ≥60)"]},
          {title:"SOCSO Categories",items:["Cat 1: Injury + Invalidity","Cat 2: Injury only (age >60)","Wage ceiling: RM 5,000/month","Rate: 1.75% ER + 0.5% EE"]},
          {title:"PCB Tax Brackets",items:["RM 0–5k: 0%","RM 5k–20k: 1%","RM 20k–35k: 3%","RM 35k–50k: 6%","RM 50k–70k: 11%","RM 70k–100k: 19%"]},
        ].map((box,i)=>(
          <Card key={i}>
            <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:12}}>{box.title}</div>
            {box.items.map((item,j)=>(
              <div key={j} style={{color:C.ts,fontSize:12,padding:"6px 0",
                borderBottom:`1px solid ${C.border}55`,display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:C.accent,flexShrink:0}}>▸</span>{item}
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

function AIModule(){
  return(
    <div>
      <SectionHead title="AI Payroll Intelligence Engine"
        sub="Anomaly detection · duplicate claim identification · PCB gap analysis"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:C.red,
              animation:"pulse 1.5s infinite"}}/>
            <span style={{color:C.tp,fontWeight:700,fontSize:14}}>Active Risk Alerts</span>
            <Chip text="3" c={C.red}/>
          </div>
          {aiAlerts.map((a,i)=>(
            <div key={i} style={{borderLeft:`3px solid ${a.sev==="HIGH"?C.red:C.amber}`,
              paddingLeft:14,marginBottom:14,paddingBottom:14,
              borderBottom:i<aiAlerts.length-1?`1px solid ${C.border}55`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{color:C.tp,fontWeight:700,fontSize:13}}>{a.type}</span>
                <StatusChip s={a.sev}/>
              </div>
              <div style={{color:C.ts,fontSize:12,marginBottom:8,lineHeight:1.5}}>{a.desc}</div>
              <RiskBar score={a.score}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <Btn sm c={C.red}>Freeze Payroll</Btn>
                <Btn sm>Investigate</Btn>
                <Btn sm c={C.ts}>Dismiss</Btn>
              </div>
            </div>
          ))}
        </Card>
        <div>
          <Card style={{marginBottom:16}}>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>Detection Rules</div>
            {[
              ["Salary Anomaly","Increase >30% month-over-month","40%"],
              ["Duplicate Claim","Same amount ±1 day","30%"],
              ["OT Abuse",">80 hrs/month","20%"],
              ["PCB Gap","Under-deduction >RM 500","10%"],
            ].map((r,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}55`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{r[0]}</span>
                  <Chip text={`w:${r[2]}`} c={C.purple}/>
                </div>
                <div style={{color:C.ts,fontSize:12,marginTop:3}}>{r[1]}</div>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:10}}>Risk Score Formula</div>
            <div style={{background:C.surface,borderRadius:8,padding:14,
              fontFamily:"monospace",fontSize:12,color:C.accent,lineHeight:2}}>
              <div>Risk = (Salary × 0.40)</div>
              <div style={{paddingLeft:16}}>+ (Duplicate × 0.30)</div>
              <div style={{paddingLeft:16}}>+ (OT Abuse × 0.20)</div>
              <div style={{paddingLeft:16}}>+ (PCB Gap × 0.10)</div>
              <div style={{color:C.red,marginTop:6,fontWeight:700}}>⚑ Flag if Risk &gt; 0.65</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BankModule(){
  return(
    <div>
      <SectionHead title="Bank Payment Files"
        sub="Auto-generate Maybank GIRO · CIMB BizChannel · RHB Reflex salary upload"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:16}}>
        {bankFiles.map((b,i)=>(
          <Card key={i} style={{borderTop:`3px solid ${b.status==="Ready"?C.green:C.amber}`}}>
            <div style={{fontSize:28,marginBottom:8}}>🏦</div>
            <div style={{color:C.tp,fontSize:16,fontWeight:800,marginBottom:4}}>{b.bank}</div>
            <div style={{color:C.ts,fontSize:12,marginBottom:14}}>{b.format}</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{color:C.ts,fontSize:12}}>Employees</span>
              <span style={{color:C.tp,fontWeight:700}}>{b.count}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              <span style={{color:C.ts,fontSize:12}}>Total Amount</span>
              <span style={{color:C.green,fontWeight:700}}>{b.amount}</span>
            </div>
            <div style={{marginBottom:12}}><StatusChip s={b.status}/></div>
            <Btn c={b.status==="Ready"?C.green:C.amber}>
              {b.status==="Ready"?"↓ Download File":"Request Approval"}
            </Btn>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:12}}>
          File Preview — Maybank GIRO Fixed Width
        </div>
        <div style={{background:"#1a2332",borderRadius:10,padding:18,
          fontFamily:"monospace",fontSize:12,color:"#7dd3fc",lineHeight:2,overflow:"auto"}}>
          <div style={{color:"#94a3b8",marginBottom:6}}># Header Record</div>
          <div>HDR TechCorp Sdn Bhd        202506300001 MYR</div>
          <div style={{color:"#94a3b8",margin:"8px 0 4px"}}># Detail Records</div>
          <div>DTL 156201234567890 0000580000 Ahmad Farid           SALARY</div>
          <div>DTL 156200987654321 0000420000 Siti Nurul Ain        SALARY</div>
          <div>DTL 156201122334455 0000750000 Rajesh Kumar          SALARY</div>
          <div style={{color:"#94a3b8",margin:"8px 0 4px"}}># Trailer Record</div>
          <div>TRL 0000247 0000124498000</div>
        </div>
      </Card>
    </div>
  );
}

function ReportsModule(){
  return(
    <div>
      <SectionHead title="Reports & Analytics"
        sub="Statutory filings · HR analytics · payroll registers"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
        {[
          {title:"📋 Statutory Reports",color:C.amber,items:["EA Form (Employee Income Statement)","EPF Form A — Monthly","SOCSO Borang 8A — Monthly","EIS Submission File","PCB CP39 — Monthly","HRDF Levy Form"]},
          {title:"📊 HR Analytics",color:C.accent,items:["Headcount by Department","Turnover Rate Analysis","Absenteeism Trend","Payroll Cost Ratio","Overtime Hours Report","Leave Balance Summary"]},
          {title:"💰 Payroll Reports",color:C.green,items:["Payroll Register — Detailed","Salary Bank Listing","Statutory Contribution Summary","GL Journal Entries","Year-to-Date P&L","Bonus & Commission Breakdown"]},
          {title:"🔒 Compliance Reports",color:C.purple,items:["PDPA Data Audit Trail","AI Risk Detection Log","Payroll Change History","User Access Audit","Statutory Filing Status","Employee Exit Clearance"]},
        ].map((r,i)=>(
          <Card key={i}>
            <div style={{color:r.color,fontWeight:700,fontSize:14,marginBottom:14}}>{r.title}</div>
            {r.items.map((item,j)=>(
              <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"9px 0",borderBottom:`1px solid ${C.border}55`}}>
                <span style={{color:C.tp,fontSize:13}}>{item}</span>
                <div style={{display:"flex",gap:6}}>
                  <Btn sm c={C.red}>PDF</Btn>
                  <Btn sm c={C.green}>Excel</Btn>
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

function MyPortal({viewAsEmployee}){
  const [tab,setTab]=useState("payslips");
  const [selPayslip,setSelPayslip]=useState(null);
  const emp=viewAsEmployee||INIT_EMPLOYEES[0];

  const PayslipDetail=({ps})=>{
    const gross=ps.basic+ps.transport+ps.bonus;
    const totalDed=ps.epf+ps.socso+ps.eis+ps.pcb;
    return(
      <div>
        <Card style={{marginBottom:16}}>
          {/* Payslip header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
            paddingBottom:16,marginBottom:16,borderBottom:`2px solid ${C.accent}55`}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <Logo/>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{color:C.tp,fontWeight:800,fontSize:15}}>PAYSLIP</div>
              <div style={{color:C.ts,fontSize:13}}>{ps.period}</div>
              <div style={{marginTop:4}}><StatusChip s={ps.status}/></div>
            </div>
          </div>
          {/* Employee info */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,
            background:C.surface,borderRadius:10,padding:16,marginBottom:16}}>
            {[["Employee Name",emp.name],["Employee ID",emp.id],["Department",emp.dept],
              ["Grade",emp.grade],["NRIC",emp.nric],["Position",emp.role]].map(([l,v])=>(
              <div key={l}>
                <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:.6}}>{l.toUpperCase()}</div>
                <div style={{color:C.tp,fontSize:13,fontWeight:600,marginTop:3}}>{v}</div>
              </div>
            ))}
          </div>
          {/* Earnings & Deductions */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div>
              <div style={{color:C.green,fontSize:11,fontWeight:800,letterSpacing:.8,
                marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:C.green,display:"inline-block"}}/>
                EARNINGS
              </div>
              {[["Basic Salary",ps.basic],["Transport Allowance",ps.transport],
                ...(ps.bonus>0?[["Bonus",ps.bonus]]:[])].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",
                  padding:"8px 0",borderBottom:`1px solid ${C.border}55`}}>
                  <span style={{color:C.ts,fontSize:13}}>{l}</span>
                  <span style={{color:C.tp,fontWeight:600}}>
                    RM {v.toLocaleString("en",{minimumFractionDigits:2})}
                  </span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0"}}>
                <span style={{color:C.tp,fontWeight:700}}>Gross Earnings</span>
                <span style={{color:C.green,fontWeight:800,fontSize:14}}>
                  RM {gross.toLocaleString("en",{minimumFractionDigits:2})}
                </span>
              </div>
            </div>
            <div>
              <div style={{color:C.red,fontSize:11,fontWeight:800,letterSpacing:.8,
                marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:C.red,display:"inline-block"}}/>
                DEDUCTIONS
              </div>
              {[["EPF (11%)",ps.epf],["SOCSO",ps.socso],["EIS (0.2%)",ps.eis],["PCB (MTD)",ps.pcb]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",
                  padding:"8px 0",borderBottom:`1px solid ${C.border}55`}}>
                  <span style={{color:C.ts,fontSize:13}}>{l}</span>
                  <span style={{color:C.red,fontWeight:600}}>
                    − RM {v.toLocaleString("en",{minimumFractionDigits:2})}
                  </span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0"}}>
                <span style={{color:C.tp,fontWeight:700}}>Total Deductions</span>
                <span style={{color:C.red,fontWeight:800,fontSize:14}}>
                  − RM {totalDed.toLocaleString("en",{minimumFractionDigits:2})}
                </span>
              </div>
            </div>
          </div>
          {/* Net Pay */}
          <div style={{background:"linear-gradient(135deg,#D1FAE5,#E0F4FB)",
            border:`1.5px solid ${C.green}55`,borderRadius:12,
            padding:"18px 22px",display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:16}}>
            <div>
              <div style={{color:C.ts,fontSize:11,fontWeight:700,letterSpacing:.8}}>
                NET PAY FOR {ps.period.toUpperCase()}
              </div>
              <div style={{color:C.ts,fontSize:11,marginTop:3}}>
                Credited to account ending ••••7890
              </div>
            </div>
            <div style={{color:C.green,fontWeight:900,fontSize:26,letterSpacing:-1}}>
              RM {ps.net.toLocaleString("en",{minimumFractionDigits:2})}
            </div>
          </div>
          {/* Employer contributions */}
          <div style={{background:C.surface,borderRadius:10,padding:14,marginBottom:16}}>
            <div style={{color:C.ts,fontSize:10,fontWeight:700,letterSpacing:.8,marginBottom:8}}>
              EMPLOYER STATUTORY CONTRIBUTIONS (FOR REFERENCE)
            </div>
            <div style={{display:"flex",gap:24}}>
              {[["EPF (12%)",`RM ${(ps.basic*0.12).toFixed(2)}`],
                ["SOCSO",`RM ${ps.socso.toFixed(2)}`],
                ["EIS",`RM ${(ps.basic*0.002).toFixed(2)}`]].map(([l,v])=>(
                <div key={l}>
                  <div style={{color:C.ts,fontSize:11}}>{l}</div>
                  <div style={{color:C.accent,fontWeight:700,fontSize:13,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn c={C.accent} onClick={()=>{
              const w=window.open("","_blank");
              w.document.write(`<html><head><title>Payslip ${ps.period}</title>
              <style>body{font-family:system-ui;padding:40px;max-width:600px;margin:0 auto;color:#0f172a}
              h1{color:#0ea5c9;font-size:20px}h2{color:#475569;font-size:13px;letter-spacing:1px;text-transform:uppercase}
              .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0}
              .net{background:#D1FAE5;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:16px}
              .net-amount{color:#059669;font-size:22px;font-weight:900}
              .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0}
              </style></head><body>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div><h1>HRCloud Malaysia</h1><p style="color:#475569;margin:0;font-size:12px">MALAYSIA · ENTERPRISE</p></div>
                <div style="text-align:right"><strong>PAYSLIP</strong><br/><span style="color:#475569">${ps.period}</span></div>
              </div>
              <hr/>
              <div class="grid">
                <div><small>EMPLOYEE</small><br/><strong>${emp.name}</strong></div>
                <div><small>ID</small><br/><strong>${emp.id}</strong></div>
                <div><small>DEPARTMENT</small><br/><strong>${emp.dept}</strong></div>
                <div><small>NRIC</small><br/><strong>${emp.nric}</strong></div>
              </div>
              <h2>Earnings</h2>
              <div class="row"><span>Basic Salary</span><span>RM ${ps.basic.toFixed(2)}</span></div>
              <div class="row"><span>Transport Allowance</span><span>RM ${ps.transport.toFixed(2)}</span></div>
              ${ps.bonus>0?`<div class="row"><span>Bonus</span><span>RM ${ps.bonus.toFixed(2)}</span></div>`:""}
              <div class="row"><strong>Gross</strong><strong>RM ${gross.toFixed(2)}</strong></div>
              <h2>Deductions</h2>
              <div class="row"><span>EPF (11%)</span><span>- RM ${ps.epf.toFixed(2)}</span></div>
              <div class="row"><span>SOCSO</span><span>- RM ${ps.socso.toFixed(2)}</span></div>
              <div class="row"><span>EIS (0.2%)</span><span>- RM ${ps.eis.toFixed(2)}</span></div>
              <div class="row"><span>PCB (MTD)</span><span>- RM ${ps.pcb.toFixed(2)}</span></div>
              <div class="net"><span>NET PAY FOR ${ps.period.toUpperCase()}</span><span class="net-amount">RM ${ps.net.toFixed(2)}</span></div>
              <p style="color:#94a3b8;font-size:11px;margin-top:20px">This is a computer-generated payslip. No signature required.</p>
              </body></html>`);
              w.document.close();w.print();
            }}>↓ Download / Print PDF</Btn>
            <Btn c={C.ts} onClick={()=>setSelPayslip(null)}>← Back to List</Btn>
          </div>
        </Card>
      </div>
    );
  };

  return(
    <div>
      <div style={{marginBottom:20}}>
        <h2 style={{color:C.tp,fontSize:19,fontWeight:800,margin:0,letterSpacing:-.4}}>
          My Portal — Employee Self Service
        </h2>
        <p style={{color:C.ts,fontSize:13,margin:"5px 0 0"}}>
          Logged in as: <strong style={{color:C.accent}}>{emp.name}</strong> · {emp.id} · {emp.dept}
        </p>
      </div>

      {/* Quick stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[
          ["📅 Annual Leave","12 days",C.green,C.greenL],
          ["🏥 Sick Leave","18 days",C.accent,C.accentL],
          ["🧾 Pending Claims","RM 320.50",C.amber,C.amberL],
          ["💰 Last Payslip","RM 4,908.65",C.purple,C.purpleL],
        ].map(([l,v,c,bg])=>(
          <Card key={l} style={{padding:"14px 16px",borderTop:`3px solid ${c}`}}>
            <div style={{color:C.ts,fontSize:11,fontWeight:700,letterSpacing:.6}}>{l.toUpperCase()}</div>
            <div style={{color:c,fontSize:18,fontWeight:800,marginTop:4}}>{v}</div>
          </Card>
        ))}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["payslips","💰 Payslips"],["leaves","📅 My Leaves"],["claims","🧾 My Claims"],["profile","◉ My Profile"]].map(([id,label])=>(
          <button key={id} onClick={()=>{setTab(id);setSelPayslip(null);}} style={{
            background:tab===id?C.accentL:"transparent",
            color:tab===id?C.accent:C.ts,
            border:`1.5px solid ${tab===id?C.accent+"66":C.border}`,
            borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit",transition:"all .15s",
          }}>{label}</button>
        ))}
      </div>

      {tab==="payslips"&&(
        selPayslip?<PayslipDetail ps={selPayslip}/>:(
          <div>
            <Card noPad style={{overflow:"hidden",marginBottom:16}}>
              <div style={{padding:"14px 20px",background:C.surface,borderBottom:`1px solid ${C.border}`,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:C.tp,fontWeight:700,fontSize:14}}>Payslip History</span>
                <span style={{color:C.ts,fontSize:12}}>{PAYSLIPS.length} records</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr><TH>Period</TH><TH right>Gross</TH><TH right>EPF</TH><TH right>SOCSO</TH><TH right>PCB</TH><TH right>Net Pay</TH><TH>Status</TH><TH>Actions</TH></tr></thead>
                <tbody>
                  {PAYSLIPS.map((ps,i)=>{
                    const gross=ps.basic+ps.transport+ps.bonus;
                    return(
                      <tr key={i}>
                        <TD bold><span style={{color:C.accent}}>{ps.period}</span></TD>
                        <TD right>{gross.toLocaleString("en",{minimumFractionDigits:2})}</TD>
                        <TD right c={C.ts}>{ps.epf.toFixed(2)}</TD>
                        <TD right c={C.ts}>{ps.socso.toFixed(2)}</TD>
                        <TD right c={C.purple}>{ps.pcb.toFixed(2)}</TD>
                        <TD right bold><span style={{color:C.green}}>
                          {ps.net.toLocaleString("en",{minimumFractionDigits:2})}
                        </span></TD>
                        <TD><StatusChip s={ps.status}/></TD>
                        <TD><div style={{display:"flex",gap:6}}>
                          <Btn sm onClick={()=>setSelPayslip(ps)}>View</Btn>
                          <Btn sm c={C.green} onClick={()=>setSelPayslip(ps)}>↓ PDF</Btn>
                        </div></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            <Card style={{background:C.amberL,border:`1.5px solid ${C.amber}44`}}>
              <div style={{color:C.amber,fontSize:13,fontWeight:700,marginBottom:10}}>
                📊 YTD Summary 2025 — {emp.name.split(" ")[0]}
              </div>
              <div style={{display:"flex",gap:28}}>
                {[["YTD Gross","RM 38,400"],["YTD EPF","RM 3,828"],["YTD PCB","RM 3,016"],["YTD Net","RM 30,652"]].map(([l,v])=>(
                  <div key={l}>
                    <div style={{color:C.ts,fontSize:11}}>{l}</div>
                    <div style={{color:C.amber,fontWeight:800,fontSize:15,marginTop:2}}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )
      )}
      {tab==="leaves"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>Leave Balance</div>
            {[["Annual Leave","12","16",C.green],["Sick Leave","18","22",C.accent],
              ["Hospitalization","60","60",C.ts],["Carry Forward","3","6",C.amber]].map(([type,bal,ent,c])=>(
              <div key={type} style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}55`}}>
                <span style={{color:C.ts,fontSize:13}}>{type}</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{color:C.ts,fontSize:12}}>{ent} days ent.</span>
                  <Chip text={`${bal} days`} c={c}/>
                </div>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>My Applications</div>
            {leaveData.filter(l=>l.name==="Ahmad Farid").map((l,i)=>(
              <div key={i} style={{background:C.surface,borderRadius:10,padding:12,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:C.tp,fontWeight:600,fontSize:13}}>{l.type}</span>
                  <StatusChip s={l.status}/>
                </div>
                <div style={{color:C.ts,fontSize:12,marginTop:4}}>{l.from} → {l.to} · {l.days} day(s)</div>
              </div>
            ))}
            <div style={{marginTop:4}}><Btn c={C.green}>+ Apply New Leave</Btn></div>
          </Card>
        </div>
      )}
      {tab==="claims"&&(
        <Card noPad style={{overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>Ref</TH><TH>Type</TH><TH right>Amount</TH><TH>Date</TH><TH>Merchant</TH><TH>Status</TH></tr></thead>
            <tbody>
              {claimsData.filter(c=>c.name==="Ahmad Farid").map((c,i)=>(
                <tr key={i}>
                  <TD c={C.accent} bold>{c.id}</TD>
                  <TD>{c.type}</TD>
                  <TD right bold>RM {c.amount.toFixed(2)}</TD>
                  <TD c={C.ts}>{c.date}</TD>
                  <TD c={C.ts}>{c.merchant}</TD>
                  <TD><StatusChip s={c.status}/></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {tab==="profile"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16,
              paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
              <Avatar name={emp.name} size={52}/>
              <div>
                <div style={{color:C.tp,fontSize:15,fontWeight:800}}>{emp.name}</div>
                <div style={{color:C.ts,fontSize:12,marginTop:2}}>{emp.role} · {emp.dept}</div>
              </div>
            </div>
            {[["Full Name",emp.name],["NRIC",emp.nric],["Employee ID",emp.id],
              ["Department",emp.dept],["Grade",emp.grade],["Status",emp.status]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",
                padding:"8px 0",borderBottom:`1px solid ${C.border}44`}}>
                <span style={{color:C.ts,fontSize:12}}>{l}</span>
                <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>
              Statutory & Bank Info
            </div>
            {[["EPF No.","EP-"+emp.id.replace("E","")+"01"],["SOCSO No.","SO-"+emp.id.replace("E","")+"01"],
              ["Tax No.","SG-"+emp.id.replace("E","")+"0000"],["Bank","Maybank"],
              ["Account No.","••••••7890"],["DuitNow","Registered"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",
                padding:"8px 0",borderBottom:`1px solid ${C.border}44`}}>
                <span style={{color:C.ts,fontSize:12}}>{l}</span>
                <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function MobilePreview(){
  const [screen,setScreen]=useState("home");
  return(
    <div>
      <SectionHead title="Mobile App Preview"
        sub="Employee self-service: Leave · Geo-fence · OCR Claims · Payslip"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:32,alignItems:"start"}}>
        <div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
            {["home","punch","leave","claim","payslip"].map(s=>(
              <button key={s} onClick={()=>setScreen(s)} style={{
                background:screen===s?C.accentL:"transparent",
                color:screen===s?C.accent:C.ts,
                border:`1.5px solid ${screen===s?C.accent+"66":C.border}`,
                borderRadius:6,padding:"5px 14px",fontSize:11,fontWeight:600,
                cursor:"pointer",textTransform:"capitalize",fontFamily:"inherit",
              }}>{s}</button>
            ))}
          </div>
          {/* Phone mockup */}
          <div style={{width:280,background:"#0f1824",borderRadius:38,padding:14,
            border:"8px solid #1e2d3d",margin:"0 auto",
            boxShadow:"0 30px 60px rgba(0,0,0,.2)"}}>
            <div style={{background:"#fff",borderRadius:26,overflow:"hidden",height:500,
              display:"flex",flexDirection:"column"}}>
              <div style={{background:C.accent,padding:"10px 18px",
                display:"flex",justifyContent:"space-between",fontSize:10,color:"#fff",fontWeight:600}}>
                <span>9:41</span><span>●●●● WiFi 🔋</span>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:16,background:C.bg}}>
                {screen==="home"&&<div>
                  <div style={{color:C.tp,fontWeight:700,fontSize:15,marginBottom:2}}>Good morning,</div>
                  <div style={{color:C.accent,fontWeight:900,fontSize:17,marginBottom:14}}>Ahmad Farid 👋</div>
                  <div style={{background:"#fff",borderRadius:12,padding:12,marginBottom:12,
                    boxShadow:"0 1px 4px rgba(14,165,201,.1)"}}>
                    <div style={{color:C.ts,fontSize:10,fontWeight:700}}>TODAY'S STATUS</div>
                    <div style={{color:C.green,fontWeight:700,fontSize:13,margin:"4px 0"}}>✓ Checked In · 08:52</div>
                    <div style={{color:C.ts,fontSize:10}}>Geo-fence validated · KL HQ</div>
                  </div>
                  {[["📅 Annual Leave","12 days",C.green],["🧾 Claims Pending","RM 320.50",C.amber],["💰 Last Payslip","RM 4,908.65",C.purple]].map(([l,v,c])=>(
                    <div key={l} style={{background:"#fff",borderRadius:10,padding:10,marginBottom:8,
                      display:"flex",justifyContent:"space-between",alignItems:"center",
                      boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                      <span style={{color:C.ts,fontSize:11}}>{l}</span>
                      <span style={{color:c,fontWeight:700,fontSize:12}}>{v}</span>
                    </div>
                  ))}
                </div>}
                {screen==="punch"&&<div style={{textAlign:"center",paddingTop:20}}>
                  <div style={{color:C.ts,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:20}}>GEO-FENCE ATTENDANCE</div>
                  <div style={{width:120,height:120,borderRadius:"50%",background:C.greenL,
                    border:`3px solid ${C.green}`,display:"flex",alignItems:"center",
                    justifyContent:"center",margin:"0 auto 16px",cursor:"pointer",
                    boxShadow:"0 4px 20px rgba(5,150,105,.2)"}}>
                    <div>
                      <div style={{fontSize:30}}>⊕</div>
                      <div style={{color:C.green,fontSize:11,fontWeight:800}}>CHECK IN</div>
                    </div>
                  </div>
                  <div style={{background:"#fff",borderRadius:10,padding:12,
                    boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
                    <div style={{color:C.green,fontSize:11,fontWeight:600}}>✓ GPS: 3.1478°N, 101.6953°E</div>
                    <div style={{color:C.ts,fontSize:10,marginTop:3}}>Within 100m of KL HQ</div>
                  </div>
                </div>}
                {screen==="leave"&&<div>
                  <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:12}}>Apply Leave</div>
                  {[["Leave Type","Annual Leave ▾"],["From","10 Jun 2025"],["To","12 Jun 2025"],["Days","3 days"]].map(([l,v])=>(
                    <div key={l} style={{background:"#fff",borderRadius:8,padding:10,marginBottom:8,
                      boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                      <div style={{color:C.ts,fontSize:9,fontWeight:700,letterSpacing:.6}}>{l.toUpperCase()}</div>
                      <div style={{color:C.tp,fontSize:12,fontWeight:600,marginTop:2}}>{v}</div>
                    </div>
                  ))}
                  <div style={{background:C.accentL,borderRadius:8,padding:10,marginBottom:10}}>
                    <div style={{color:C.accent,fontSize:11,fontWeight:600}}>Balance: 12 days remaining</div>
                  </div>
                  <div style={{background:C.green,borderRadius:8,padding:10,textAlign:"center",
                    color:"#fff",fontWeight:700,fontSize:13}}>Submit Application</div>
                </div>}
                {screen==="claim"&&<div>
                  <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:12}}>Submit Claim</div>
                  <div style={{background:"#fff",border:`2px dashed ${C.border}`,borderRadius:12,
                    padding:20,textAlign:"center",marginBottom:12}}>
                    <div style={{fontSize:28}}>📷</div>
                    <div style={{color:C.ts,fontSize:11,marginTop:6}}>Snap receipt for OCR</div>
                  </div>
                  {[["Merchant","Petronas TTDI ✓"],["Date","05 Jun 2025 ✓"],["Amount","RM 320.50 ✓"]].map(([l,v])=>(
                    <div key={l} style={{background:"#fff",borderRadius:8,padding:10,marginBottom:8}}>
                      <div style={{color:C.ts,fontSize:9,fontWeight:700,letterSpacing:.6}}>{l.toUpperCase()}</div>
                      <div style={{color:C.green,fontSize:12,fontWeight:600,marginTop:2}}>{v}</div>
                    </div>
                  ))}
                  <div style={{background:C.amber,borderRadius:8,padding:10,textAlign:"center",
                    color:"#fff",fontWeight:700,fontSize:13,marginTop:4}}>Submit Claim</div>
                </div>}
                {screen==="payslip"&&<div>
                  <div style={{color:C.tp,fontWeight:700,fontSize:13,marginBottom:4}}>Payslip · June 2025</div>
                  <div style={{color:C.ts,fontSize:11,marginBottom:12}}>Ahmad Farid · E001</div>
                  {[["Basic Salary","5,800.00"],["Transport Allow.","200.00"]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,
                      padding:"5px 0",borderBottom:`1px solid ${C.border}55`}}>
                      <span style={{color:C.ts}}>{l}</span>
                      <span style={{color:C.tp}}>RM {v}</span>
                    </div>
                  ))}
                  {[["EPF","638.00"],["SOCSO","29.75"],["EIS","11.60"],["PCB","412.00"]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,
                      padding:"5px 0",borderBottom:`1px solid ${C.border}55`}}>
                      <span style={{color:C.ts}}>{l}</span>
                      <span style={{color:C.red}}>− {v}</span>
                    </div>
                  ))}
                  <div style={{background:C.greenL,border:`1px solid ${C.green}44`,borderRadius:10,
                    padding:12,display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginTop:10}}>
                    <span style={{color:C.ts,fontSize:12,fontWeight:700}}>NET PAY</span>
                    <span style={{color:C.green,fontWeight:900,fontSize:16}}>RM 4,908.65</span>
                  </div>
                  <div style={{background:C.accentL,border:`1px solid ${C.accent}44`,borderRadius:8,
                    padding:10,textAlign:"center",marginTop:10,cursor:"pointer"}}>
                    <span style={{color:C.accent,fontSize:12,fontWeight:700}}>↓ Download PDF</span>
                  </div>
                </div>}
              </div>
              {/* Bottom nav */}
              <div style={{background:"#fff",padding:"10px 16px",borderTop:`1px solid ${C.border}`,
                display:"flex",justifyContent:"space-around"}}>
                {[["⬡","Home"],["⊕","Punch"],["◇","Leave"],["◈","Claim"]].map(([icon,label],i)=>(
                  <div key={i} style={{textAlign:"center"}}>
                    <div style={{fontSize:17,color:i===0?C.accent:C.ts}}>{icon}</div>
                    <div style={{fontSize:9,color:i===0?C.accent:C.ts,fontWeight:i===0?700:400}}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:14}}>App Features</div>
          {[
            ["⊕","Geo-Fence Punch","GPS validated within office radius · prevents buddy punch"],
            ["◇","Leave Application","Real-time balance · MC upload · manager push notification"],
            ["◈","OCR Claims","Snap receipt → auto-extract merchant, date, amount"],
            ["◆","Digital Payslip","Full breakdown + one-tap PDF download"],
            ["◉","Face Verification","Anti-spoofing biometric (premium tier)"],
          ].map((f,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"11px 0",
              borderBottom:`1px solid ${C.border}55`}}>
              <div style={{width:36,height:36,borderRadius:10,background:C.accentL,
                display:"flex",alignItems:"center",justifyContent:"center",
                color:C.accent,fontSize:17,flexShrink:0}}>{f[0]}</div>
              <div>
                <div style={{color:C.tp,fontSize:13,fontWeight:600}}>{f[1]}</div>
                <div style={{color:C.ts,fontSize:12,marginTop:2,lineHeight:1.5}}>{f[2]}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function SetupModule(){
  return(
    <div>
      <SectionHead title="System Setup"
        sub="Company, branch, department, designation & statutory registration"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:16}}>Company Profile</div>
          {[["Company","TechCorp Sdn. Bhd."],["SSM No.","202001012345 (1234567-X)"],
            ["LHDN Tax No.","C 1234567890"],["EPF No.","EP 1234567"],
            ["SOCSO No.","SO 1234567"],["EIS No.","EI 1234567"],
            ["HRDF No.","HRD/TC/2020/0001"],
            ["Payroll Cycle","Monthly — Last Working Day"],["FY End","31 December"]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",
              padding:"9px 0",borderBottom:`1px solid ${C.border}55`}}>
              <span style={{color:C.ts,fontSize:12,fontWeight:600}}>{l}</span>
              <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{v}</span>
            </div>
          ))}
        </Card>
        <div>
          <Card style={{marginBottom:16}}>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:12}}>Payroll Settings</div>
            {[["OT Rate (Rest Day)","2× basic rate"],["OT Rate (Public Holiday)","3× basic rate"],
              ["Leave Accrual","Monthly"],["Carry Forward Limit","50% entitlement"],
              ["Probation Leave","Not eligible (Annual Leave)"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",
                padding:"9px 0",borderBottom:`1px solid ${C.border}55`}}>
                <span style={{color:C.ts,fontSize:12}}>{l}</span>
                <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{color:C.tp,fontWeight:700,fontSize:14,marginBottom:12}}>Multi-Tenant Security</div>
            {[["Architecture","Shared DB + Tenant ID"],["Encryption","AES-256 + TLS 1.3"],
              ["Authentication","JWT + 2FA (TOTP)"],["Roles","5-tier RBAC"],
              ["Compliance","PDPA · 7yr retention"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",
                padding:"9px 0",borderBottom:`1px solid ${C.border}55`}}>
                <span style={{color:C.ts,fontSize:12}}>{l}</span>
                <span style={{color:C.tp,fontSize:13,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN APP ──────────────────────────────────────────────────*/
export default function HRSaaS(){
  const [active,setActive]=useState("dashboard");
  const [employees,setEmployees]=useState(INIT_EMPLOYEES);
  const [rolePerms,setRolePerms]=useState(INIT_ROLE_PERMS);
  const [viewRole,setViewRole]=useState("HR Manager");

  const visibleMods=rolePerms[viewRole]||new Set();
  const NAV=ALL_MODULES.filter(m=>visibleMods.has(m.id));

  // Reset to first available module if current becomes invisible
  const safeActive=visibleMods.has(active)?active:(NAV[0]?.id||"dashboard");
  if(safeActive!==active)setActive(safeActive);

  const renderModule=()=>{
    switch(active){
      case "dashboard":        return <Dashboard/>;
      case "setup":            return <SetupModule/>;
      case "employee":         return <EmployeeModule employees={employees} setEmployees={setEmployees}/>;
      case "payroll":          return <PayrollModule/>;
      case "statutory":        return <StatutoryModule/>;
      case "leave":            return <LeaveModule/>;
      case "attendance":       return <AttendanceModule/>;
      case "claims":           return <ClaimsModule/>;
      case "ai":               return <AIModule/>;
      case "reports":          return <ReportsModule/>;
      case "bank":             return <BankModule/>;
      case "mobile":           return <MobilePreview/>;
      case "hierarchy":        return <HierarchyModule employees={employees} setEmployees={setEmployees}/>;
      case "permissions":      return <PermissionsModule employees={employees} rolePerms={rolePerms} setRolePerms={setRolePerms}/>;
      case "myportal":         return <MyPortal viewAsEmployee={employees[0]}/>;
      case "payroll-settings": return <PayrollSettingsModule employees={employees} setEmployees={setEmployees}/>;
      default:                 return <Dashboard/>;
    }
  };

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,
      fontFamily:"'Segoe UI','Helvetica Neue',sans-serif",overflow:"hidden",
      color:C.tp}}>

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <div style={{width:220,background:C.sidebar,borderRight:`1.5px solid ${C.sidebarBorder}`,
        display:"flex",flexDirection:"column",flexShrink:0,
        boxShadow:"2px 0 12px rgba(14,165,201,.06)"}}>

        {/* Logo */}
        <div style={{padding:"20px 18px 16px",borderBottom:`1.5px solid ${C.border}`}}>
          <Logo/>
        </div>

        {/* Role switcher */}
        <div style={{padding:"10px 12px",borderBottom:`1.5px solid ${C.border}`}}>
          <div style={{color:C.ts,fontSize:9,fontWeight:700,letterSpacing:.8,
            marginBottom:5}}>VIEW AS ROLE (DEMO)</div>
          <select value={viewRole} onChange={e=>{setViewRole(e.target.value);setActive("dashboard");}}
            style={{...selectStyle,width:"100%",fontSize:11}}>
            {Object.keys(ROLE_PRESETS).map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Nav items */}
        <div style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
          {NAV.map(m=>{
            const isActive=active===m.id;
            return(
              <button key={m.id} onClick={()=>setActive(m.id)} style={{
                width:"100%",display:"flex",alignItems:"center",gap:10,
                background:isActive?C.accentL:"transparent",
                color:isActive?C.accent:C.ts,
                border:`1.5px solid ${isActive?C.accent+"55":"transparent"}`,
                borderRadius:9,padding:"9px 12px",marginBottom:2,
                fontSize:12,fontWeight:isActive?700:500,cursor:"pointer",
                textAlign:"left",fontFamily:"inherit",transition:"all .12s",
              }}>
                <span style={{fontSize:13,opacity:isActive?1:.6}}>{m.icon}</span>
                <span style={{flex:1}}>{m.label}</span>
                {m.id==="ai"&&<span style={{background:C.red,borderRadius:10,
                  padding:"1px 6px",fontSize:9,color:"#fff",fontWeight:700}}>3</span>}
                {m.id==="myportal"&&<span style={{background:C.green,borderRadius:10,
                  padding:"1px 6px",fontSize:9,color:"#fff",fontWeight:700}}>ME</span>}
                {m.id==="payroll-settings"&&<span style={{background:C.accent,borderRadius:10,
                  padding:"1px 6px",fontSize:9,color:"#fff",fontWeight:700}}>EPF</span>}
              </button>
            );
          })}
        </div>

        {/* User badge */}
        <div style={{padding:"14px 16px",borderTop:`1.5px solid ${C.border}`,
          background:C.surface}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Avatar name="Ahmad Farid" size={32}/>
            <div>
              <div style={{color:C.tp,fontSize:12,fontWeight:700}}>Ahmad Farid</div>
              <div style={{color:C.ts,fontSize:10,marginTop:1}}>{viewRole}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div style={{flex:1,overflow:"auto",padding:"28px 30px"}}>
        {renderModule()}
      </div>
    </div>
  );
}
