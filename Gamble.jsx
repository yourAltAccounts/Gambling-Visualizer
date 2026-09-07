import { useState, useEffect, useRef, useCallback } from "react";

const SYMBOLS = [
  { id:"blank",   emoji:"⬛", weight:25, payout3:0,   payout2:0,   color:"#1a1a2e", isBlank:true },
  { id:"cherry",  emoji:"🍒", weight:35, payout3:2,   payout2:1,   color:"#ff4466" },
  { id:"lemon",   emoji:"🍋", weight:25, payout3:3,   payout2:0,   color:"#ffee44" },
  { id:"orange",  emoji:"🍊", weight:20, payout3:5,   payout2:1.5, color:"#ff8833" },
  { id:"grape",   emoji:"🍇", weight:12, payout3:10,  payout2:2,   color:"#aa66ff" },
  { id:"bell",    emoji:"🔔", weight:8,  payout3:20,  payout2:5,   color:"#ffcc00" },
  { id:"star",    emoji:"⭐", weight:4,  payout3:50,  payout2:10,  color:"#88ddff" },
  { id:"diamond", emoji:"💎", weight:1,  payout3:200, payout2:20,  color:"#ffffff" },
];
const SYMBOL_POOL = SYMBOLS.flatMap(s => Array(s.weight).fill(s));

const SEG_TYPE = {
  JACKPOT:  { color:"#ffffff", label:"JACKPOT",  textColor:"#000", isWin:true  },
  BIG_WIN:  { color:"#ffdd00", label:"BIG WIN",  textColor:"#000", isWin:true  },
  WIN:      { color:"#00cc55", label:"WIN",       textColor:"#fff", isWin:true  },
  NEAR_MISS:{ color:"#ff8833", label:"NEAR",      textColor:"#fff", isWin:false },
  LOSS:     { color:"#cc1133", label:"LOSS",      textColor:"#fff", isWin:false },
  BIG_LOSS: { color:"#6600aa", label:"BIG LOSS",  textColor:"#fff", isWin:false },
};

const BET_DIR = { WIN:"WIN", LOSS:"LOSS" };

const START_WEALTH   = 105_000_000_000;
const ELON_WEALTH    = 785_500_000_000;
const MAX_ACCOUNTS   = 5;
const ACCOUNT_COLORS = ["#00ff88","#ff9900","#bb88ff","#ff4488","#00ccff"];

const fmt = n => {
  const a=Math.abs(n), s=n<0?"-":"";
  if(a>=1e9) return `${s}$${(a/1e9).toFixed(2)}B`;
  if(a>=1e6) return `${s}$${(a/1e6).toFixed(2)}M`;
  if(a>=1e3) return `${s}$${(a/1e3).toFixed(2)}K`;
  return `${s}$${a.toFixed(2)}`;
};

const drawSymbol = () => SYMBOL_POOL[Math.floor(Math.random()*SYMBOL_POOL.length)];
const spinReels  = () => [drawSymbol(),drawSymbol(),drawSymbol()];

function calcPayout(reels) {
  const [a,b,c]=reels;
  if(a.id===b.id&&b.id===c.id) return a.isBlank?{mult:0,type:"blank3"}:{mult:a.payout3,type:"3match"};
  if(a.id===b.id&&!a.isBlank) return {mult:a.payout2,type:"2match_ab"};
  if(b.id===c.id&&!b.isBlank) return {mult:b.payout2,type:"2match_bc"};
  if(a.id===c.id&&!a.isBlank) return {mult:a.payout2,type:"2match_ac"};
  return {mult:0,type:"miss"};
}

function classifySegment(payout, betAmount) {
  if(payout.mult>=50)          return SEG_TYPE.JACKPOT;
  if(payout.mult>=20)          return SEG_TYPE.BIG_WIN;
  if(payout.mult>0)            return SEG_TYPE.WIN;
  if(payout.type!=="miss")     return SEG_TYPE.NEAR_MISS;
  if(betAmount>=1_000_000_000) return SEG_TYPE.BIG_LOSS;
  return SEG_TYPE.LOSS;
}

function applyPayout(wealth, bet, mult) {
  const actualBet = Math.min(bet, wealth);
  const winnings  = actualBet * mult;
  return { newWealth: Math.max(0, wealth - actualBet + winnings), actualBet, winnings };
}

function createSoundEngine() {
  let ctx=null;
  const gc=()=>{ if(!ctx) ctx=new(window.AudioContext||window.webkitAudioContext)(); return ctx; };
  const pt=(freq,type,dur,vol=0.3,d=0)=>{
    try{
      const ac=gc(),o=ac.createOscillator(),g=ac.createGain();
      o.connect(g);g.connect(ac.destination);
      o.type=type;o.frequency.value=freq;
      const t=ac.currentTime+d;
      g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
      o.start(t);o.stop(t+dur);
    }catch(e){}
  };
  return {
    reelSpin:()=>{for(let i=0;i<6;i++)pt(80+Math.random()*40,"sawtooth",0.08,0.15,i*0.05);},
    reelStop:(i)=>{pt(120-i*15,"square",0.1,0.25);pt(60,"sine",0.05,0.2,0.05);},
    coinClink:()=>{pt(1200,"sine",0.12,0.2);pt(1600,"sine",0.08,0.08,0.04);},
    winJingle:(m)=>{[523,659,784,1047,1319,1047,784,659,523,659,784,1047].slice(0,Math.min(Math.ceil(m),8)).forEach((f,i)=>pt(f,"sine",0.25,0.35,i*0.1));},
    jackpot:()=>{
      [523,659,784,1047,1319,1568,1319,1568,2093,1568,1319,1047,784,1047,1319,1568].forEach((f,i)=>pt(f,"sine",0.3,0.45,i*0.09));
      [392,494,587,784].forEach((f,i)=>pt(f,"triangle",0.4,0.25,i*0.18));
      [80,60,100,80].forEach((f,i)=>pt(f,"sawtooth",0.2,0.5,i*0.3+0.1));
    },
    victory:()=>{
      [523,659,784,1047,1319,1568,2093,1568,1319,1047,784,659,523,659,784,1047,1319,1568,2093,2093].forEach((f,i)=>pt(f,"sine",0.4,0.5,i*0.08));
      [261,329,392,523,659,784].forEach((f,i)=>pt(f,"triangle",0.6,0.3,i*0.16));
    },
    bankruptBuzz:()=>{[200,160,120,80,60].forEach((f,i)=>pt(f,"sawtooth",0.4,0.4,i*0.15));},
    lossBuzz:()=>{pt(180,"sawtooth",0.3,0.25);pt(120,"sawtooth",0.2,0.2,0.15);},
    nearMiss:()=>{pt(660,"sine",0.15,0.2);pt(440,"sawtooth",0.2,0.25,0.15);},
    rouletteClick:()=>{pt(800,"square",0.05,0.1);},
    rouletteWin:()=>{[880,1047,1319,1760].forEach((f,i)=>pt(f,"sine",0.2,0.3,i*0.08));},
  };
}

const makeAccount = (index, wealth) => ({
  id:index, wealth, startWealth:wealth, round:0, bankrupt:false,
  color:ACCOUNT_COLORS[index%ACCOUNT_COLORS.length],
  label:index===0?"Slots":`Alt ${index}`,
  reels:[SYMBOLS[1],SYMBOLS[2],SYMBOLS[3]], lastPayout:null,
});

function WinLights({active,isJackpot,isBigWin}){
  const count=isJackpot?20:16;
  if(!active) return null;
  return(
    <div style={{position:"absolute",inset:-14,pointerEvents:"none",zIndex:5}}>
      {Array.from({length:count}).map((_,i)=>{
        const ang=(i/count)*360, rad=ang*Math.PI/180;
        const x=50+53*Math.cos(rad), y=50+53*Math.sin(rad);
        const color=isJackpot?(i%4===0?"#ffdd00":i%4===1?"#ffffff":i%4===2?"#ff9900":"#00ffff")
          :isBigWin?(i%2===0?"#ffdd00":"#00ff88"):(i%2===0?"#00ff88":"#00aaff");
        const sz=isJackpot?13:9;
        return <div key={i} style={{position:"absolute",left:`${x}%`,top:`${y}%`,width:sz,height:sz,borderRadius:"50%",background:color,boxShadow:`0 0 ${isJackpot?22:14}px ${color},0 0 ${isJackpot?40:22}px ${color}88`,transform:"translate(-50%,-50%)",animation:`bulbFlash ${0.2+(i%4)*0.1}s ease-in-out infinite alternate`,animationDelay:`${(i/count)*0.25}s`}}/>;
      })}
      {isJackpot&&Array.from({length:10}).map((_,i)=>{
        const ang=(i/10)*360+18,rad=ang*Math.PI/180;
        const x=50+62*Math.cos(rad),y=50+62*Math.sin(rad);
        return <div key={`o${i}`} style={{position:"absolute",left:`${x}%`,top:`${y}%`,width:8,height:8,borderRadius:"50%",background:i%2===0?"#ff4400":"#aa00ff",boxShadow:"0 0 16px currentColor",transform:"translate(-50%,-50%)",animation:`bulbFlash ${0.3+(i%3)*0.12}s ease-in-out infinite alternate`,animationDelay:`${(i/10)*0.4+0.1}s`}}/>;
      })}
    </div>
  );
}

function ReelStrip({symbol,spinning,stopped}){
  if(!spinning||stopped){
    return <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:symbol.isBlank?24:44}}>{symbol.emoji}</div>;
  }
  return(
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",animation:"spinReel 0.08s linear infinite",gap:2,paddingTop:4,overflow:"hidden"}}>
      {Array.from({length:8}).map((_,j)=>(
        <div key={j} style={{fontSize:32,lineHeight:1,opacity:Math.max(0.05,0.8-j*0.12),flexShrink:0}}>
          {SYMBOLS[(Math.floor(Date.now()/100)+j*3)%SYMBOLS.length].emoji}
        </div>
      ))}
    </div>
  );
}

function ReelDisplay({reels,spinning,stoppedReels,payout}){
  const isWin=payout&&payout.mult>0;
  const isJackpot=payout&&payout.mult>=50;
  const isBigWin=payout&&payout.mult>=20&&payout.mult<50;
  const allStopped=stoppedReels.every(Boolean);
  return(
    <div style={{background:"#080818",border:`2px solid ${isJackpot?"#ffffff":isWin?"#00ff88":"#1a1a3a"}`,borderRadius:14,padding:"14px 18px",position:"relative",boxShadow:isJackpot?"0 0 60px #ffffff88,0 0 120px #ffdd0044":isWin?"0 0 30px #00ff8833":"0 0 10px #00000088",transition:"border 0.3s,box-shadow 0.3s"}}>
      <WinLights active={isWin&&allStopped&&!spinning} isJackpot={isJackpot} isBigWin={isBigWin}/>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        {reels.map((sym,i)=>{
          const stopped=stoppedReels[i], isSpin=spinning&&!stopped;
          return(
            <div key={i} style={{width:80,height:88,background:"#0d0d24",border:`2px solid ${!isSpin&&sym.color?sym.color+"88":"#2a2a4a"}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative",boxShadow:!isSpin?`0 0 14px ${sym.color}44`:"none",transition:"border 0.15s,box-shadow 0.15s"}}>
              <ReelStrip symbol={sym} spinning={spinning} stopped={stopped}/>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:10,textAlign:"center",minHeight:22,fontSize:14,fontWeight:700,letterSpacing:2,color:isJackpot?"#ffdd00":isWin?"#00ff88":payout?"#ff3355":"#22224a",textShadow:isJackpot?"0 0 16px #ffdd00":isWin?"0 0 8px #00ff88":"none",transition:"color 0.3s"}}>
        {payout
          ?payout.mult>=50?`💎 JACKPOT ${payout.mult}x`
          :payout.mult>=20?`⭐ BIG WIN ${payout.mult}x`
          :payout.mult>0?`WIN ${payout.mult}x`
          :payout.type==="blank3"?"BLANK · BLANK · BLANK"
          :payout.type==="miss"?"NO MATCH":"NEAR MISS"
          :""}
      </div>
    </div>
  );
}

function BetInput({value,onChange,disabled,accentColor="#00ff88"}){
  const [raw,setRaw]=useState(String(value));
  const [focused,setFocused]=useState(false);
  const parse=str=>{
    const s=str.trim().toLowerCase().replace(/,/g,"").replace(/\$/g,"");
    const m=s.match(/^([0-9.]+)\s*([kmb]?)$/);
    if(!m) return null;
    const n=parseFloat(m[1]);
    if(isNaN(n)||n<=0) return null;
    return Math.round(n*(m[2]==="k"?1e3:m[2]==="m"?1e6:m[2]==="b"?1e9:1));
  };
  const commit=()=>{
    const p=parse(raw);
    if(p&&p>=1){onChange(p);setRaw(String(p));}else setRaw(String(value));
    setFocused(false);
  };
  useEffect(()=>{if(!focused) setRaw(String(value));},[value,focused]);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <input type="text" value={focused?raw:fmt(value)}
        onFocus={()=>{setRaw(String(value));setFocused(true);}}
        onChange={e=>setRaw(e.target.value)} onBlur={commit}
        onKeyDown={e=>{if(e.key==="Enter")commit();}}
        disabled={disabled} placeholder="e.g. 500k, 1.5m, 2b"
        style={{background:"#0a0a1a",border:`1px solid ${focused?accentColor:"#1a1a3a"}`,color:focused?accentColor:"#d8d8f0",padding:"7px 12px",borderRadius:6,fontSize:14,fontFamily:"'Courier New',monospace",width:180,outline:"none",opacity:disabled?0.5:1,boxShadow:focused?`0 0 8px ${accentColor}44`:"none",transition:"border 0.2s,box-shadow 0.2s"}}
      />
      {focused&&<div style={{fontSize:11,color:"#33335a",paddingLeft:2}}>k=thousands · m=millions · b=billions</div>}
    </div>
  );
}

function Btn({onClick,disabled,bg,accent,label}){
  return(
    <button onClick={onClick} disabled={disabled} style={{background:bg,border:`1px solid ${accent}`,color:accent,padding:"8px 14px",borderRadius:6,cursor:disabled?"not-allowed":"pointer",fontFamily:"'Courier New',monospace",fontSize:13,letterSpacing:1,fontWeight:700,boxShadow:`0 0 6px ${accent}33`,opacity:disabled?0.35:1,transition:"opacity 0.2s"}}>
      {label}
    </button>
  );
}

function RouletteWheel({segments,spinning,spinAngle,rouletteBet,setRouletteBet,betDir,setBetDir,onSpin}){
  const W=340,CX=W/2,CY=W/2,R=140,IN=50;
  const count=segments.length;
  const arc=(s,e,r)=>{
    const toR=a=>(a-90)*Math.PI/180;
    const x1=CX+r*Math.cos(toR(s)),y1=CY+r*Math.sin(toR(s));
    const x2=CX+r*Math.cos(toR(e)),y2=CY+r*Math.sin(toR(e));
    return `M ${CX} ${CY} L ${x1} ${y1} A ${r} ${r} 0 ${e-s>180?1:0} 1 ${x2} ${y2} Z`;
  };
  const slp=(i,t)=>{
    const mid=(i+0.5)*(360/t),toR=a=>(a-90)*Math.PI/180,r=(R+IN)/2;
    return {x:CX+r*Math.cos(toR(mid)),y:CY+r*Math.sin(toR(mid)),rotate:mid};
  };
  const winSegs =segments.filter(s=>s.type.isWin).length;
  const lossSegs=segments.length-winSegs;
  const winPct  =count>0?((winSegs/count)*100).toFixed(1):"—";
  const lossPct =count>0?((lossSegs/count)*100).toFixed(1):"—";

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
      <div style={{fontSize:13,letterSpacing:3,color:"#44447a",fontWeight:700}}>ROULETTE WHEEL</div>

      {/* Bet direction */}
      <div style={{width:"100%"}}>
        <div style={{fontSize:12,color:"#44447a",letterSpacing:2,marginBottom:6}}>BET ON</div>
        <div style={{display:"flex",gap:8}}>
          {[
            {dir:BET_DIR.WIN, label:"▲ WIN", pct:winPct, active:"#002a12", activeBorder:"#00ff88", activeColor:"#00ff88"},
            {dir:BET_DIR.LOSS,label:"▼ LOSS",pct:lossPct,active:"#2a0008", activeBorder:"#ff2244", activeColor:"#ff2244"},
          ].map(({dir,label,pct,active,activeBorder,activeColor})=>(
            <button key={dir} onClick={()=>setBetDir(dir)} style={{
              flex:1,padding:"8px 0",borderRadius:6,fontSize:13,fontWeight:700,
              fontFamily:"'Courier New',monospace",cursor:"pointer",letterSpacing:1,
              background:betDir===dir?active:"#0a0a1a",
              border:`2px solid ${betDir===dir?activeBorder:"#1a1a3a"}`,
              color:betDir===dir?activeColor:"#33335a",
              boxShadow:betDir===dir?`0 0 12px ${activeBorder}44`:"none",
              transition:"all 0.2s",
            }}>
              {label}<br/>
              <span style={{fontSize:11,opacity:0.7}}>{count>0?`${pct}% chance`:"—"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Roulette bet */}
      <div style={{width:"100%"}}>
        <div style={{fontSize:12,color:"#44447a",letterSpacing:2,marginBottom:6}}>ROULETTE BET</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <BetInput value={rouletteBet} onChange={setRouletteBet} accentColor="#00ccff"/>
          <span style={{fontSize:16,fontWeight:900,color:"#00ccff"}}>{fmt(rouletteBet)}</span>
        </div>
      </div>

      {/* Wheel */}
      <div style={{position:"relative",width:W,height:W}}>
        <div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"12px solid transparent",borderRight:"12px solid transparent",borderTop:"24px solid #ffdd00",filter:"drop-shadow(0 0 8px #ffdd00)",zIndex:10}}/>
        <svg width={W} height={W} style={{transform:`rotate(${spinAngle}deg)`,transition:spinning?"transform 4s cubic-bezier(0.17,0.67,0.12,0.99)":"none",filter:"drop-shadow(0 0 20px #00001888)"}}>
          <circle cx={CX} cy={CY} r={R+8} fill="#0a0a20" stroke="#2a2a5a" strokeWidth={3}/>
          {count===0?(
            <g>
              <circle cx={CX} cy={CY} r={R} fill="#0f0f22"/>
              <text x={CX} y={CY-10} textAnchor="middle" dominantBaseline="central" fill="#22224a" fontSize={14} fontFamily="'Courier New',monospace">Spin slots to</text>
              <text x={CX} y={CY+10} textAnchor="middle" dominantBaseline="central" fill="#22224a" fontSize={14} fontFamily="'Courier New',monospace">build wheel</text>
            </g>
          ):segments.map((seg,i)=>{
            const ang=360/count,pos=slp(i,count);
            return(
              <g key={i}>
                <path d={arc(i*ang,(i+1)*ang,R)} fill={seg.type.color} stroke="#040410" strokeWidth={1.5} opacity={0.92}/>
                {count<=36&&<text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill={seg.type.textColor} fontSize={Math.max(7,Math.min(11,280/count))} fontFamily="'Courier New',monospace" fontWeight="700" transform={`rotate(${pos.rotate},${pos.x},${pos.y})`} opacity={0.9}>{seg.type.label}</text>}
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={IN} fill="#080818" stroke="#2a2a5a" strokeWidth={2}/>
          <circle cx={CX} cy={CY} r={IN-8} fill="#0d0d24"/>
          <text x={CX} y={CY-8} textAnchor="middle" dominantBaseline="central" fill="#44447a" fontSize={12} fontFamily="'Courier New',monospace" fontWeight="700">{count}</text>
          <text x={CX} y={CY+8} textAnchor="middle" dominantBaseline="central" fill="#22224a" fontSize={10} fontFamily="'Courier New',monospace">segs</text>
        </svg>
      </div>

      <button onClick={onSpin} disabled={count===0||spinning} style={{background:"#0a1a0a",border:`2px solid ${spinning?"#224422":"#00ff88"}`,color:spinning?"#224422":"#00ff88",padding:"12px 32px",borderRadius:8,fontSize:16,fontWeight:900,letterSpacing:3,cursor:(count===0||spinning)?"not-allowed":"pointer",fontFamily:"'Courier New',monospace",boxShadow:spinning?"none":"0 0 20px #00ff8833",opacity:count===0?0.3:1,transition:"all 0.3s"}}>
        {spinning?"SPINNING...":"🎡 SPIN ROULETTE"}
      </button>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
        {Object.values(SEG_TYPE).map(t=>(
          <div key={t.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
            <div style={{width:14,height:14,borderRadius:3,background:t.color,flexShrink:0}}/>
            <span style={{color:"#44447a"}}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountPanel({account,spinning,stoppedReels}){
  const {wealth,startWealth,color,label,round,bankrupt,reels,lastPayout}=account;
  const nd=wealth-startWealth;
  return(
    <div style={{background:"#080818",border:`1px solid ${bankrupt?"#ff2244":color}44`,borderRadius:12,padding:"16px 18px",flex:"1 1 300px",minWidth:280,opacity:bankrupt?0.55:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div style={{fontSize:12,color,letterSpacing:2,fontWeight:700}}>{label.toUpperCase()} · Round {round}</div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:20,fontWeight:900,color,textShadow:`0 0 10px ${color}`,fontVariantNumeric:"tabular-nums"}}>{fmt(wealth)}</div>
          <div style={{fontSize:13,color:nd>=0?"#00ff88":"#ff3355",fontVariantNumeric:"tabular-nums"}}>{nd>=0?"+":""}{fmt(nd)} net</div>
        </div>
      </div>
      <ReelDisplay reels={reels} spinning={spinning} stoppedReels={stoppedReels} payout={lastPayout}/>
    </div>
  );
}

function EndScreen({type,round,onReset}){
  const isV=type==="victory";
  const glow=isV?"#ffdd00":"#ff0033";
  const title=isV?"🏆 YOU BEAT ELON":"💸 BANKRUPT";
  const sub=isV
    ?`In ${round} rounds you went from $105B to $785.5B. The PTM halts and accepts.`
    :`In ${round} rounds the house edge drove wealth to $0. The PTM halts and rejects.`;
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,background:`${isV?"#0a0800":"#0a0004"}ee`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:28,backdropFilter:"blur(10px)"}}>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
        {Array.from({length:isV?48:24}).map((_,i)=>{
          const t=i/(isV?48:24), ang=t*360;
          const dist=180+Math.random()*160;
          const px=50+Math.cos(ang*Math.PI/180)*dist/8;
          const py=50+Math.sin(ang*Math.PI/180)*dist/8;
          const color=isV?(i%4===0?"#ffdd00":i%4===1?"#ffffff":i%4===2?"#ff9900":"#00ffff"):(i%3===0?"#ff2244":i%3===1?"#6600aa":"#ff8833");
          return <div key={i} style={{position:"absolute",left:`${px}%`,top:`${py}%`,width:isV?10:7,height:isV?10:7,borderRadius:"50%",background:color,boxShadow:`0 0 18px ${color}`,animation:`bulbFlash ${0.25+(i%5)*0.08}s ease-in-out infinite alternate`,animationDelay:`${t*0.6}s`}}/>;
        })}
      </div>
      <div style={{fontSize:isV?56:46,fontWeight:900,color:glow,textShadow:`0 0 40px ${glow},0 0 80px ${glow}88`,letterSpacing:2,animation:"celebrationPulse 1.2s ease infinite",textAlign:"center",fontFamily:"'Courier New',monospace",zIndex:1}}>{title}</div>
      <div style={{fontSize:16,color:"#d8d8f0",textAlign:"center",maxWidth:520,lineHeight:1.8,fontFamily:"'Courier New',monospace",background:"#08081899",padding:"20px 32px",borderRadius:14,border:`1px solid ${glow}44`,zIndex:1}}>{sub}</div>
      <div style={{fontSize:14,color:"#44447a",fontFamily:"'Courier New',monospace",textAlign:"center",zIndex:1}}>
        <div style={{color:glow,fontSize:26,fontWeight:900,marginBottom:4}}>ROUND {round}</div>
        <div>total spins to {isV?"q_accept":"q_reject"}</div>
      </div>
      <button onClick={onReset} style={{background:"#0a0a1a",border:`2px solid ${glow}`,color:glow,padding:"14px 44px",borderRadius:8,fontSize:16,fontWeight:900,letterSpacing:3,cursor:"pointer",fontFamily:"'Courier New',monospace",boxShadow:`0 0 24px ${glow}44`,zIndex:1}}>↺ RESET</button>
    </div>
  );
}

export default function App(){
  const accountsRef                              = useRef([makeAccount(0,START_WEALTH)]);
  const [accounts,setAccounts]                   = useState(accountsRef.current);

  const betAmountRef                             = useRef(1_000_000);
  const [betAmount,setBetAmount]                 = useState(1_000_000);

  const [running,setRunning]                     = useState(false);
  const [globalRound,setGlobalRound]             = useState(0);
  const [log,setLog]                             = useState([]);
  const [spinning,setSpinning]                   = useState(false);
  const [stoppedReels,setStoppedReels]           = useState([false,false,false]);
  const [endScreen,setEndScreen]                 = useState(null);

  const rouletteSegmentsRef                      = useRef([]);
  const [rouletteSegmentsState,setRouletteSegmentsRaw] = useState([]);
  const rouletteSegments                         = rouletteSegmentsState;
  const setRouletteSegments                      = useCallback((updater) => {
    const next = typeof updater === "function" ? updater(rouletteSegmentsRef.current) : updater;
    rouletteSegmentsRef.current = next;
    setRouletteSegmentsRaw(next);
  }, []);

  const [rouletteSpinning,setRouletteSpinning]   = useState(false);
  const [rouletteAngle,setRouletteAngle]         = useState(0);
  const [rouletteResult,setRouletteResult]       = useState(null);

  const rouletteBetRef                           = useRef(1_000_000);
  const [rouletteBet,setRouletteBetState]        = useState(1_000_000);
  const setRouletteBet                           = useCallback((v) => { rouletteBetRef.current = v; setRouletteBetState(v); }, []);

  const betDirRef                                = useRef(BET_DIR.WIN);
  const [betDir,setBetDirState]                  = useState(BET_DIR.WIN);
  const setBetDir                                = useCallback((v) => { betDirRef.current = v; setBetDirState(v); }, []);

  const soundRef = useRef(null);
  const getSound = useCallback(() => {
    if(!soundRef.current) soundRef.current = createSoundEngine();
    return soundRef.current;
  }, []);

  const checkTerminal = useCallback((accs) => {
    const total = accs.reduce((s,a) => s+a.wealth, 0);
    if(total >= ELON_WEALTH){
      setRunning(false); setEndScreen("victory"); getSound().victory();
    } else if(accs.every(a => a.bankrupt)){
      setRunning(false); setEndScreen("bankrupt"); getSound().bankruptBuzz();
    }
  }, [getSound]);

  const runRound = useCallback(() => {
    if(spinning) return;
    const bet = betAmountRef.current;
    const snd = getSound();

    const results = accountsRef.current.map(acc => {
      if(acc.bankrupt) return null;
      const reels   = spinReels();
      const payout  = calcPayout(reels);
      const {newWealth,actualBet,winnings} = applyPayout(acc.wealth, bet, payout.mult);
      const newRound = acc.round + 1;
      const bankrupt = newWealth <= 0;
      const seg      = classifySegment(payout, actualBet);
      const netChange = winnings - actualBet;
      return {reels,payout,actualBet,winnings,newWealth,newRound,bankrupt,seg,netChange};
    });

    setSpinning(true);
    setStoppedReels([false,false,false]);
    snd.reelSpin();

    [550,950,1350].forEach((delay,i) => {
      setTimeout(() => {
        snd.reelStop(i);
        setStoppedReels(prev => { const n=[...prev]; n[i]=true; return n; });

        if(i === 0){
          const u = accountsRef.current.map((acc,ai) => { const r=results[ai]; if(!r) return acc; return {...acc,reels:[r.reels[0],acc.reels[1],acc.reels[2]]}; });
          accountsRef.current = u; setAccounts([...u]);
        } else if(i === 1){
          const u = accountsRef.current.map((acc,ai) => { const r=results[ai]; if(!r) return acc; return {...acc,reels:[r.reels[0],r.reels[1],acc.reels[2]]}; });
          accountsRef.current = u; setAccounts([...u]);
        } else {
          setTimeout(() => {
            setSpinning(false);
            const newSegs=[]; const logEntries=[];
            const updated = accountsRef.current.map((acc,ai) => {
              const r = results[ai]; if(!r) return acc;
              if(r.payout.mult>=50)      snd.jackpot();
              else if(r.payout.mult>=20) snd.winJingle(r.payout.mult);
              else if(r.payout.mult>0)   snd.coinClink();
              else if(r.payout.type!=="miss"&&r.payout.type!=="blank3") snd.nearMiss();
              else snd.lossBuzz();
              newSegs.push({type:r.seg,reels:r.reels,netChange:r.netChange,accountColor:acc.color,accountLabel:acc.label,payout:r.payout});
              logEntries.push({label:acc.label,color:acc.color,payout:r.payout,betAmount:r.actualBet,wealth:r.newWealth,reels:r.reels});
              return {...acc,wealth:r.newWealth,round:r.newRound,bankrupt:r.bankrupt,reels:r.reels,lastPayout:r.payout};
            });
            accountsRef.current = updated;
            setAccounts([...updated]);
            setGlobalRound(g => { const nr=g+1; checkTerminal(updated); return nr; });
            setLog(prev => [logEntries,...prev].slice(0,80));
            setRouletteSegments(prev => [...prev,...newSegs].slice(-1000));
          }, 180);
        }
      }, delay);
    });
  }, [spinning, getSound, checkTerminal, setRouletteSegments]);

  useEffect(() => {
    if(!running || endScreen || spinning) return;
    const t = setTimeout(runRound, 350);
    return () => clearTimeout(t);
  }, [running, globalRound, spinning, runRound, endScreen]);

  const spinRoulette = useCallback(() => {
    if (rouletteSpinning || rouletteSegmentsRef.current.length === 0) return;
    
    const snd = getSound();
    setRouletteSpinning(true);
    setRouletteResult(null);

    const segments = rouletteSegmentsRef.current;
    const total = segments.length;
    const winIdx = Math.floor(Math.random() * total);
    const segAng = 360 / total;
    const targetAng = -(winIdx * segAng + segAng / 2);
    const finalAng = rouletteAngle + (5 + Math.floor(Math.random() * 3)) * 360 + targetAng - (rouletteAngle % 360);

    let clicks = 0;
    const ci = setInterval(() => { 
      snd.rouletteClick(); 
      if (++clicks > 20) clearInterval(ci); 
    }, 180);
    
    setRouletteAngle(finalAng);

    setTimeout(() => {
      clearInterval(ci);
      setRouletteSpinning(false);

      const seg = segments[winIdx];
      setRouletteResult({ seg, idx: winIdx });

      const landedWin = seg.type.isWin;
      const playerWon = (betDirRef.current === BET_DIR.WIN && landedWin) ||
                        (betDirRef.current === BET_DIR.LOSS && !landedWin);

      const currentAccounts = accountsRef.current;
      const numAccounts = currentAccounts.length;

      const totalWealthBefore = currentAccounts.reduce((sum, acc) => sum + acc.wealth, 0);
      
      const actualBet = Math.min(rouletteBetRef.current, totalWealthBefore);
      
      let newTotalWealth;
      if (playerWon) {
        const mult = seg.type === SEG_TYPE.JACKPOT ? 10 : (seg.type === SEG_TYPE.BIG_WIN ? 3 : 1.5);
        newTotalWealth = totalWealthBefore + (actualBet * mult);
        snd.rouletteWin();
      } else {
        newTotalWealth = Math.max(0, totalWealthBefore - actualBet);
        snd.lossBuzz();
      }

      const splitWealth = newTotalWealth / numAccounts;
      
      const updated = currentAccounts.map((acc) => {
        const isBankrupt = splitWealth <= 0;
        return { 
          ...acc, 
          wealth: splitWealth, 
          bankrupt: isBankrupt 
        };
      });

      accountsRef.current = updated;
      setAccounts([...updated]);
      checkTerminal(updated);
      
    }, 4200);
  }, [rouletteSpinning, rouletteAngle, getSound, checkTerminal]);

  const spawnAlt = () => {
    if(accountsRef.current.length >= MAX_ACCOUNTS || running) return;
    const n = accountsRef.current.length;
    const split = START_WEALTH / (n+1);
    const updated = [...accountsRef.current.map(a => ({...a,startWealth:split,wealth:Math.min(a.wealth,split)})), makeAccount(n,split)];
    accountsRef.current = updated; setAccounts([...updated]);
  };

  const reset = () => {
    const fresh = [makeAccount(0, START_WEALTH)];
    accountsRef.current = fresh; setAccounts(fresh);
    setGlobalRound(0); setLog([]);
    setRouletteSegments([]); setRouletteAngle(0); setRouletteResult(null);
    setRunning(false); setSpinning(false); setStoppedReels([false,false,false]);
    setEndScreen(null);
  };

  const totalWealth  = accounts.reduce((s,a) => s+a.wealth, 0);
  const totalNet     = totalWealth - START_WEALTH;
  const allBankrupt  = accounts.every(a => a.bankrupt);
  const progressPct  = Math.min(100, (totalWealth/ELON_WEALTH)*100);
  const betColor     = betAmount>=1_000_000_000?"#ff2244":betAmount>=100_000_000?"#ff8844":betAmount>=10_000_000?"#ffdd00":"#00ff88";

  return(
    <div style={{minHeight:"100vh",background:"#040410",color:"#d8d8f0",fontFamily:"'Courier New',monospace",backgroundImage:"radial-gradient(ellipse at 10% 0%,#0a0a28,transparent 50%),radial-gradient(ellipse at 90% 100%,#180008,transparent 50%)"}}>
      <style>{`
        @keyframes spinReel{from{transform:translateY(0)}to{transform:translateY(-24px)}}
        @keyframes bulbFlash{from{opacity:0.25;transform:translate(-50%,-50%) scale(0.6)}to{opacity:1;transform:translate(-50%,-50%) scale(1.3)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes celebrationPulse{0%,100%{text-shadow:0 0 40px currentColor}50%{text-shadow:0 0 80px currentColor,0 0 120px currentColor}}
      `}</style>

      {endScreen && <EndScreen type={endScreen} round={globalRound} onReset={reset}/>}

      {/* HEADER */}
      <div style={{padding:"14px 22px",borderBottom:"1px solid #14143a",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#05050f99",backdropFilter:"blur(10px)",position:"sticky",top:0,zIndex:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,letterSpacing:1}}>🎰 Catch Up to Elon</div>
          <div style={{fontSize:12,color:"#44447a",marginTop:2}}>
            Bill Gates = <span style={{color:"#00ff88"}}>{fmt(START_WEALTH)}</span>
            {"  ·  "}Elon Musk = <span style={{color:"#ffdd00"}}>{fmt(ELON_WEALTH)}</span>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:26,fontWeight:900,fontVariantNumeric:"tabular-nums",color:totalWealth>=ELON_WEALTH?"#ffdd00":totalWealth/START_WEALTH>0.5?"#00ff88":"#ff4444",textShadow:"0 0 14px currentColor",transition:"color 0.3s"}}>{fmt(totalWealth)}</div>
          <div style={{fontSize:13,color:totalNet>=0?"#00ff88":"#ff3355",fontVariantNumeric:"tabular-nums"}}>{totalNet>=0?"+":""}{fmt(totalNet)} · round {globalRound}</div>
          <div style={{marginTop:4,width:200}}>
            <div style={{height:4,background:"#1a1a3a",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${progressPct}%`,background:"linear-gradient(90deg,#00ff88,#00aaff)",borderRadius:2,transition:"width 0.4s"}}/>
            </div>
            <div style={{fontSize:12,color:"#33335a",textAlign:"right",marginTop:2}}>{progressPct.toFixed(1)}% · {fmt(Math.max(0,ELON_WEALTH-totalWealth))} to go</div>
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div style={{padding:"12px 22px",borderBottom:"1px solid #10102a",background:"#06060e",display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:12,letterSpacing:3,color:"#44447a",marginBottom:6}}>SLOT BET</div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <BetInput value={betAmount} onChange={v=>{setBetAmount(v);betAmountRef.current=v;}} disabled={running||spinning} accentColor={betColor}/>
            <span style={{fontSize:20,fontWeight:900,color:betColor,textShadow:`0 0 8px ${betColor}`}}>{fmt(betAmount)}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {!allBankrupt&&!endScreen&&(
            <>
              <Btn onClick={()=>{getSound();runRound();}} disabled={spinning} bg="#10102a" accent="#5555cc" label="🎰 Spin"/>
              <Btn onClick={()=>{getSound();setRunning(r=>!r);}} bg={running?"#2a0a0a":"#0a2a0a"} accent={running?"#ff4444":"#00ff88"} label={running?"⏸ Pause":"▶▶ Auto"}/>
            </>
          )}
          <Btn onClick={spawnAlt} disabled={accounts.length>=MAX_ACCOUNTS||running||spinning} bg="#12100a" accent="#ffaa00" label={`+ Alt (${accounts.length}/${MAX_ACCOUNTS})`}/>
          <Btn onClick={reset} disabled={spinning} bg="#1a0a00" accent="#ff6622" label="↺ Reset"/>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{padding:"16px 22px",display:"flex",gap:24,flexWrap:"wrap",alignItems:"flex-start"}}>

        {/* LEFT */}
        <div style={{flex:"1 1 340px",minWidth:300,display:"flex",flexDirection:"column",gap:14}}>
          {accounts.map(acc=>(
            <AccountPanel key={acc.id} account={acc} spinning={spinning} stoppedReels={stoppedReels}/>
          ))}

          <div style={{padding:"12px 16px",background:"#06060e",border:"1px solid #10102a",borderRadius:10}}>
            <div style={{fontSize:12,letterSpacing:3,color:"#22224a",marginBottom:8}}>PAYTABLE</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {SYMBOLS.filter(s=>s.payout3>0).map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:s.color,background:"#0a0a1a",border:`1px solid ${s.color}33`,padding:"3px 9px",borderRadius:4}}>
                  <span>{s.emoji}{s.emoji}{s.emoji}</span>
                  <span style={{color:"#44447a"}}>→</span>
                  <span>{s.payout3}x</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{padding:"12px 16px",background:"#06060e",border:"1px solid #10102a",borderRadius:10}}>
            <div style={{fontSize:12,letterSpacing:3,color:"#22224a",marginBottom:8}}>SPIN LOG</div>
            <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>
              {log.length===0&&<div style={{fontSize:12,color:"#1a1a38",fontStyle:"italic"}}>Hit Spin or Auto to begin...</div>}
              {log.map((entries,i)=>(
                <div key={i} style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                  {entries.map(e=>{
                    const isWin=e.payout.mult>0;
                    const net=isWin?`+${fmt(e.betAmount*e.payout.mult-e.betAmount)}`:`-${fmt(e.betAmount)}`;
                    return(
                      <span key={e.label} style={{fontSize:12,fontVariantNumeric:"tabular-nums",color:i===0?(isWin?e.color:"#ff3355"):"#1e1e38"}}>
                        [{e.label}] {e.reels.map(r=>r.emoji).join("")} {net} → {fmt(e.wealth)}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{flex:"0 0 400px",minWidth:340,background:"#06060e",border:"1px solid #10102a",borderRadius:12,padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
          <RouletteWheel
            segments={rouletteSegments} spinning={rouletteSpinning}
            spinAngle={rouletteAngle} rouletteBet={rouletteBet}
            setRouletteBet={setRouletteBet} betDir={betDir}
            setBetDir={setBetDir} onSpin={spinRoulette}
          />

          {rouletteResult&&!rouletteSpinning&&(()=>{
            const landedWin=rouletteResult.seg.type.isWin;
            const playerWon=(betDirRef.current===BET_DIR.WIN&&landedWin)||(betDirRef.current===BET_DIR.LOSS&&!landedWin);
            const mult=rouletteResult.seg.type===SEG_TYPE.JACKPOT?10:rouletteResult.seg.type===SEG_TYPE.BIG_WIN?3:1.5;
            return(
              <div style={{padding:"12px 16px",background:"#080818",border:`2px solid ${rouletteResult.seg.type.color}`,borderRadius:10,textAlign:"center",animation:"fadeInUp 0.4s ease",boxShadow:`0 0 20px ${rouletteResult.seg.type.color}44`}}>
                <div style={{fontSize:13,color:"#44447a",letterSpacing:2,marginBottom:6}}>LANDED · BETTING ON {betDirRef.current}</div>
                <div style={{fontSize:20,fontWeight:900,color:rouletteResult.seg.type.color}}>{rouletteResult.seg.type.label}</div>
                <div style={{fontSize:16,fontWeight:700,marginTop:6,color:playerWon?"#00ff88":"#ff3355"}}>
                  {playerWon?`+${fmt(rouletteBet*mult)}`:`-${fmt(rouletteBet)}`}
                  <span style={{fontSize:12,opacity:0.7,marginLeft:6}}>{playerWon?"✓ correct call":"✗ wrong call"}</span>
                </div>
              </div>
            );
          })()}

          {rouletteSegments.length>0&&(
            <div style={{fontSize:12,color:"#33335a",lineHeight:1.8}}>
              {Object.values(SEG_TYPE).map(t=>{
                const c=rouletteSegments.filter(s=>s.type===t).length;
                if(c===0) return null;
                const pct=((c/rouletteSegments.length)*100).toFixed(0);
                return(
                  <div key={t.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{width:10,height:10,borderRadius:2,background:t.color,display:"inline-block"}}/>
                      <span style={{color:t.color}}>{t.label}</span>
                    </span>
                    <span>{c} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}