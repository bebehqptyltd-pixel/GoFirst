import { useState, useRef, useCallback, useEffect } from "react";

// ── Audio ────────────────────────────────────────────────────
function createAudio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint:"interactive" });
    function playTone(f,d,g,type="sine"){const o=ctx.createOscillator(),gain=ctx.createGain();o.connect(gain);gain.connect(ctx.destination);o.type=type;o.frequency.setValueAtTime(f,ctx.currentTime);gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(g,ctx.currentTime+0.01);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d);o.start(ctx.currentTime);o.stop(ctx.currentTime+d);}
    return {
      resume:()=>{if(ctx.state==="suspended")ctx.resume();},
      flip:()=>{playTone(480,0.08,0.06);setTimeout(()=>playTone(380,0.12,0.04),60);},
      swipe:()=>{const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();o.connect(f);f.connect(g);g.connect(ctx.destination);o.type="sawtooth";f.type="bandpass";f.frequency.setValueAtTime(800,ctx.currentTime);f.frequency.exponentialRampToValueAtTime(200,ctx.currentTime+0.15);o.frequency.setValueAtTime(300,ctx.currentTime);g.gain.setValueAtTime(0.04,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);o.start(ctx.currentTime);o.stop(ctx.currentTime+0.15);}
    };
  } catch(e){return{resume:()=>{},flip:()=>{},swipe:()=>{}};}
}
const audio = createAudio();

// ── Memory ───────────────────────────────────────────────────
const STORAGE_KEY = "gofirst_v1";
function loadMemory(){try{const r=localStorage.getItem(STORAGE_KEY);if(!r)return{seen:[],totalPlayed:0,activeCats:null,hasSeenTutorial:false};return JSON.parse(r);}catch{return{seen:[],totalPlayed:0,activeCats:null,hasSeenTutorial:false};}}
function saveMemory(m){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(m));}catch{}}

// ── Card back ────────────────────────────────────────────────
function CardBack() {
  return (
    <div style={{width:"100%",height:"100%",borderRadius:20,overflow:"hidden",boxShadow:"0 12px 48px rgba(74,40,16,0.28),0 2px 8px rgba(74,40,16,0.12)"}}>
      <img src="https://i.imgur.com/RFAJysA.png" alt="" draggable="false" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
    </div>
  );
}

// ── Texture pill / button style ──────────────────────────────
// Paper texture via SVG filter — same material world as the card
const PAPER_FILTER = `
  <svg style="position:absolute;width:0;height:0">
    <defs>
      <filter id="paper-pill">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" result="noise"/>
        <feColorMatrix type="saturate" values="0" in="noise" result="grey"/>
        <feBlend in="SourceGraphic" in2="grey" mode="multiply" result="blend"/>
        <feComposite in="blend" in2="SourceGraphic" operator="in"/>
      </filter>
    </defs>
  </svg>
`;

// ── Data ─────────────────────────────────────────────────────
const FREE_QUESTIONS = [
  "What did you assume about me that turned out to be completely wrong?",
  "What's a moment that quietly changed you?",
  "What do you think my biggest blind spot is?",
  "What's something you've never felt fully understood about?",
  "What's your most controversial food opinion?",
  "What do you hope love feels like years from now?",
  "Tell me about a time you stood up for something and it cost you.",
  "What version of yourself comes out in relationships?",
  "What would your villain origin story be?",
  "What are you still healing from?",
];

const CATEGORY_ORDER = ["Starter","Playful & Funny","Story Questions","Attraction & Chemistry","Honest Impressions","Life & Values","Emotional Intimacy","Late Night"];

// ── Category SVG icons (stroke style, consistent with tutorial) ──
const CAT_ICONS = {
  "Starter": (col) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  ),
  "Playful & Funny": (col) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="10" x2="9.01" y2="10"/><line x1="15" y1="10" x2="15.01" y2="10"/>
    </svg>
  ),
  "Story Questions": (col) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  "Attraction & Chemistry": (col) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 3a3 3 0 0 0-3 3l3 5 3-5a3 3 0 0 0-3-3z"/><path d="M6 3a3 3 0 0 0-3 3l3 5 3-5a3 3 0 0 0-3-3z"/><path d="M6 11c0 7 6 10 6 10s6-3 6-10"/>
    </svg>
  ),
  "Honest Impressions": (col) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M12 12v9"/><path d="M9 18l3 3 3-3"/>
    </svg>
  ),
  "Life & Values": (col) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><polygon points="12 2 12 12 17 7"/>
      <line x1="12" y1="3" x2="12" y2="12"/><line x1="12" y1="12" x2="17.5" y2="6.5"/>
    </svg>
  ),
  "Emotional Intimacy": (col) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  "Late Night": (col) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
};

const CATEGORIES = {
  "Starter":               {pillBg:"#D4C4B0",pillText:"#3C2410",cardBg:"#F5EDE0",cardBorder:"#E8DDD0",questions:FREE_QUESTIONS},
  "Playful & Funny":       {pillBg:"#C4A882",pillText:"#3C2410",cardBg:"#F5EDE0",cardBorder:"#E8DDD0",questions:["What's the dumbest injury you've ever had?","What's your most irrational fear?","What's something you were convinced of as a kid that was completely wrong?","What's your most useless talent?","What's your weirdest habit when nobody is watching?","What's a hill you'll die on for absolutely no reason?","If your life had a warning label, what would it say?","What's a film or show you're embarrassed to admit you love?","What's the worst advice you've ever confidently given someone?","What's a phrase or word you say too much?","What's the most chaotic decision you've ever made on a whim?","What's something you owned as a kid that you'd be mortified by now?","What's a completely unhinged rule you have for yourself?","If your pet had to describe you to a stranger, what would they say?","What's a completely made-up skill you've pretended to have?","What's the most ridiculous thing you've ever argued about?","What's the pettiest thing you've ever done and felt zero guilt about?","What's something you're weirdly competitive about?"]},
  "Story Questions":        {pillBg:"#B8956A",pillText:"#3C2410",cardBg:"#F5EDE0",cardBorder:"#E8DDD0",questions:["Tell me about one of the best days of your life.","Tell me about a moment you laughed so hard you couldn't breathe.","What's a memory you wish you could relive for one hour?","Tell me about a time everything went spectacularly wrong.","What's a random memory you think about more than you should?","What's a tiny childhood memory you still remember vividly?","Tell me about a time you felt deeply proud of yourself.","What's a memory that still makes you emotional?","Tell me about a moment you felt truly free.","Tell me about a stranger who made a surprising impact on you.","What's a decision you made that turned out way better than expected?","Tell me about a time you surprised yourself.","What's a moment where you realised you'd changed?","Tell me about the last time you were genuinely moved by something.","What's a mistake you'd actually make again?","Tell me about a friendship that shaped who you are.","What's something you did that took more courage than people realised?"]},
  "Attraction & Chemistry": {pillBg:"#A67D55",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0",questions:["What's something non-sexual you find incredibly attractive?","When did you first realise you were attracted to me?","What kind of touch comes naturally to you?","What kind of affection makes you melt?","What's your ideal slow Sunday together?","What kind of moments make you want to kiss someone?","What creates chemistry for you beyond physical attraction?","What's something subtle someone can do that drives you wild?","What kind of intimacy matters most to you?","What's something about how someone carries themselves that draws you in?","What's a quality in someone that sneaks up on you over time?","What do you notice about someone before you notice anything else?","What makes you feel truly seen by another person?","What kind of conversation gives you that electric feeling?","What does flirting look like to you when it's done well?","What makes you feel genuinely confident around someone?","What's something you find attractive that you've never really told anyone?"]},
  "Honest Impressions":    {pillBg:"#8B6445",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0",questions:["What did you assume about me that turned out to be completely wrong?","What did you think I was like before you actually knew me?","What's something about me you still haven't figured out?","What do you think I need more of in my life?","What's something you've noticed about me that I probably don't see in myself?","What's something you think we have in common that might surprise me?","What's something you want me to know about you that I might have wrong?","What's the version of you that most people don't get to see?","What do people assume about you based on how you look or come across?","What's something you do that people misread?","What's something about me you were initially unsure about?","What's a question you've wanted to ask me but haven't yet?","What's your honest first impression of me, now that it's safe to say?","What's something you think I'm better at than I give myself credit for?","What do you think I'm like when things get hard?"]},
  "Life & Values":         {pillBg:"#52371E",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0",questions:["What matters most to you in life now?","What kind of life are you trying to build?","What does commitment mean to you?","What kind of partner do you want to be?","What does a really good ordinary life look like to you?","What are your non-negotiables in relationships?","What kind of home environment makes you happiest?","What do you think makes relationships last?","What scares you most about relationships?","What kind of future feels exciting to you?","What's something you used to want that you no longer care about?","What's a value you hold that most people in your life don't share?","What does success look like to you right now, honestly?","What would you do differently if you weren't worried about what people thought?","What chapter of your life are you in right now?","What's something you hope you never compromise on?","Who has shaped your idea of what love should look like?","What kind of person do you want to have become in ten years?"]},
  "Emotional Intimacy":    {pillBg:"#6B4A30",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0",questions:["When do you feel most emotionally safe?","What makes somewhere feel like home to you?","What helps you feel calm when life is overwhelming?","What makes you shut down emotionally?","What kind of people make you feel safe?","What's something you wish more people understood about you?","What do you need most when you're stressed?","What makes you feel deeply loved?","What kind of relationship dynamic feels healthiest to you?","What's something you protect fiercely in your life?","What do you do when you need to process something hard?","How do you know when you actually trust someone?","What does it look like when you're at your worst, and what do you need then?","What's something you've had to unlearn about how to love people?","What's a boundary you've set that changed your life?","What's something you've forgiven someone for that took a long time?","What do you wish you were better at emotionally?","What's a version of yourself you've had to leave behind?"]},
  "Late Night":            {pillBg:"#3C2410",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0",questions:["What do you think love should feel like?","What part of yourself do you struggle to show people?","What kind of relationship do you never want to repeat?","When do you feel most connected to someone?","What are you still healing from?","What does emotional loyalty mean to you?","What kind of relationship would make life feel softer?","What do you hope love feels like years from now?","What do you think about when you can't sleep?","What's the difference between being happy and being at peace?","What do you think love asks of us that we're not always ready for?","What's something you hope someone thinks about when they think about you?","What do you think is the hardest part of being human?","What's something beautiful you've found in something painful?"]},
};

const REL_ICONS = {
  friends: (col) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3"/><circle cx="16" cy="7" r="3"/>
      <path d="M3 20c0-3.3 2.7-6 6-6h1"/><path d="M10 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
    </svg>
  ),
  dating: (col) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  ),
  together: (col) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      <path d="M8 12a4 4 0 0 1 8 0" strokeDasharray="2 2"/>
    </svg>
  ),
  married: (col) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4"/>
      <path d="M12 8V4M8 12H4M12 16v4M16 12h4"/>
      <circle cx="12" cy="12" r="9"/>
    </svg>
  ),
};

const RELATIONSHIP_TYPES = [
  {id:"friends",label:"Friends",description:"Deepen a friendship",cats:["Starter","Playful & Funny","Story Questions","Honest Impressions","Life & Values"],showToggle:false},
  {id:"dating",label:"Getting to Know You",description:"Early dating",cats:["Starter","Playful & Funny","Attraction & Chemistry","Honest Impressions","Story Questions"],showToggle:false},
  {id:"together",label:"We're a Thing",description:"In a relationship",cats:["Attraction & Chemistry","Honest Impressions","Emotional Intimacy","Life & Values","Story Questions"],showToggle:true},
  {id:"married",label:"It's Us",description:"Long term or married",cats:["Emotional Intimacy","Life & Values","Late Night","Honest Impressions","Attraction & Chemistry"],showToggle:true},
];

const TUTORIAL_STEPS = [
  {title:"Welcome to Go First",body:"A card game for people brave enough to say the things typically left unsaid.",dare:null},
  {title:"Tap to reveal",body:"Each card starts face down. When you're ready, tap it to flip and reveal the question.",dare:null},
  {title:"Answer honestly",body:"Take turns answering. There are no right answers\u2026just yours.",dare:null},
  {title:"Swipe to move on",body:"When you\u2019re done, swipe left or right to reveal the next card.",dare:null},
  {title:"Change it up",body:"Turn the categories on or off at any time to change the emotional pace or lighten the mood.",dare:"Who will Go First?"},
];

function flipQuestion(q){return q.replace(/\bdo you find\b/gi,"do I find").replace(/\bdo you\b/gi,"do I").replace(/\byou find\b/gi,"I find").replace(/\byou feel\b/gi,"I feel").replace(/\byou need\b/gi,"I need").replace(/\byou want\b/gi,"I want").replace(/\byou think\b/gi,"I think").replace(/\byou wish\b/gi,"I wish").replace(/\byou love\b/gi,"I love").replace(/\byour\b/gi,"my").replace(/\bYour\b/g,"My").replace(/\byou\b/gi,"I").replace(/\bYou\b/g,"I").replace(/\bI I\b/g,"I").trim();}

function buildPool(activeCats){let pool=[];activeCats.forEach(cat=>{const data=CATEGORIES[cat];if(data)pool=[...pool,...data.questions.map(q=>({question:q,category:cat}))];});return pool;}

function pickNextUnseen(pool,seenSet,excludeQ){const unseen=pool.filter(q=>!seenSet.has(q.question)&&q.question!==excludeQ);if(unseen.length>0)return unseen[Math.floor(Math.random()*unseen.length)];const fallback=pool.filter(q=>q.question!==excludeQ);return fallback.length>0?fallback[Math.floor(Math.random()*fallback.length)]:pool[0];}

// ── Texture pill component ───────────────────────────────────
function TexturePill({cat, isOn, onClick, size="normal"}) {
  const d = CATEGORIES[cat];
  if (!d) return null;
  const small = size === "small";
  return (
    <button onClick={onClick} style={{
      position:"relative", overflow:"hidden",
      border: isOn ? "none" : `1.5px solid ${d.pillBg}`,
      borderRadius:100,
      padding: small ? "5px 12px" : "7px 15px",
      cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5,
      fontFamily:"'DM Sans',sans-serif", fontSize: small ? 10 : 11,
      fontWeight:500, letterSpacing:"0.04em", whiteSpace:"nowrap",
      color: isOn ? d.pillText : "#7A6050",
      background: isOn ? d.pillBg : "transparent",
      opacity: isOn ? 1 : 0.65,
      transition:"all 0.2s",
      boxShadow: isOn
        ? `0 2px 0 rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.1)`
        : "none",
    }}>
      {isOn && (
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.18,pointerEvents:"none"}} viewBox="0 0 200 40" preserveAspectRatio="xMidYMid slice">
          <filter id={`pf-${cat.replace(/\s/g,"")}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="200" height="40" filter={`url(#pf-${cat.replace(/\s/g,"")})`} fill="white"/>
        </svg>
      )}
      <span style={{position:"relative",display:"flex",alignItems:"center"}}>{CAT_ICONS[cat] ? CAT_ICONS[cat](isOn ? d.pillText : "#7A6050") : null}</span>
      <span style={{position:"relative"}}>{cat}</span>
    </button>
  );
}

// ── Texture button ───────────────────────────────────────────
function TextureButton({onClick, disabled, children, style={}, variant="dark"}) {
  const bg = variant === "dark" ? "#5C3418" : "#F5EDE0";
  const color = variant === "dark" ? "#F5EDD9" : "#5C3418";
  const border = variant === "ghost" ? "1.5px solid #C4A882" : "none";
  return (
    <button onClick={onClick} disabled={disabled} className="texture-btn" style={{
      position:"relative", overflow:"hidden",
      background: variant === "ghost" ? "transparent" : bg,
      color, border: variant === "ghost" ? border : "none",
      borderRadius:100, padding:"16px 48px",
      fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:500,
      letterSpacing:"0.14em", textTransform:"uppercase",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1,
      boxShadow: variant === "ghost" ? "none" : `0 3px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.15)`,
      transition:"all 0.15s",
      ...style,
    }}>
      {variant !== "ghost" && (
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.12,pointerEvents:"none"}} viewBox="0 0 300 52" preserveAspectRatio="xMidYMid slice">
          <filter id="pf-btn">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="300" height="52" filter="url(#pf-btn)" fill="white"/>
        </svg>
      )}
      <span style={{position:"relative"}}>{children}</span>
    </button>
  );
}

// ── Relationship tile ────────────────────────────────────────
function RelTile({rel, isActive, onClick}) {
  return (
    <button onClick={onClick} style={{
      position:"relative", overflow:"hidden",
      background: isActive ? "#3C2010" : "#FBF5EC",
      border: `1.5px solid ${isActive ? "#3C2010" : "#DDD0BC"}`,
      borderRadius:16, padding:"14px 10px",
      cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6,
      transition:"all 0.2s", minWidth:0, flex:1,
      boxShadow: isActive
        ? `0 4px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)`
        : `0 2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)`,
    }}>
      {isActive && (
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.1,pointerEvents:"none"}} viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
          <filter id="pf-rel">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="160" height="90" filter="url(#pf-rel)" fill="white"/>
        </svg>
      )}
      <span style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>{REL_ICONS[rel.id] ? REL_ICONS[rel.id](isActive?"#F5EDD9":"#5C3418") : null}</span>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:500,color:isActive?"#F5EDD9":"#3C2010",letterSpacing:"0.03em",textAlign:"center",lineHeight:1.3,position:"relative"}}>{rel.label}</p>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:isActive?"#C4A882":"#A08868",letterSpacing:"0.02em",position:"relative"}}>{rel.description}</p>
    </button>
  );
}

// ── Tutorial icon ────────────────────────────────────────────
function TutIcon({step}){const p={stroke:"#7A4A24",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round",fill:"none"};if(step===0)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="6" y="8" width="24" height="30" rx="3" {...p}/><rect x="12" y="4" width="24" height="30" rx="3" {...p}/><line x1="18" y1="17" x2="28" y2="17" {...p}/><line x1="18" y1="22" x2="24" y2="22" {...p}/></svg>;if(step===1)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="10" y="4" width="24" height="32" rx="3" {...p}/><path d="M22 14 L22 24 M17 20 L22 25 L27 20" {...p}/></svg>;if(step===2)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M6 10 Q6 6 10 6 L34 6 Q38 6 38 10 L38 24 Q38 28 34 28 L24 28 L16 36 L16 28 L10 28 Q6 28 6 24 Z" {...p}/><line x1="13" y1="15" x2="31" y2="15" {...p}/><line x1="13" y1="20" x2="24" y2="20" {...p}/></svg>;if(step===3)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="12" y="6" width="20" height="28" rx="3" {...p}/><path d="M4 20 L2 20 M6 16 L2 20 L6 24" {...p}/><path d="M40 20 L42 20 M38 16 L42 20 L38 24" {...p}/></svg>;if(step===4)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="4" y="8" width="16" height="10" rx="5" {...p}/><circle cx="15" cy="13" r="3" {...p}/><rect x="24" y="8" width="16" height="10" rx="5" {...p}/><circle cx="29" cy="13" r="3" {...p}/><rect x="4" y="26" width="16" height="10" rx="5" {...p}/><circle cx="15" cy="31" r="3" {...p}/><rect x="24" y="26" width="16" height="10" rx="5" {...p}/><circle cx="35" cy="31" r="3" {...p}/></svg>;return null;}

// ── Main app ─────────────────────────────────────────────────
export default function App() {
  const mem = loadMemory();
  const [screen, setScreen] = useState("home");
  const [tutStep, setTutStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(mem.hasSeenTutorial||false);
  const [activeCats, setActiveCats] = useState(mem.activeCats||[...CATEGORY_ORDER]);
  const [relationshipType, setRelationshipType] = useState(null);
  const [perspectiveFlipped, setPerspectiveFlipped] = useState(false);
  const [seenQuestions, setSeenQuestions] = useState(new Set(mem.seen||[]));
  const [totalPlayed, setTotalPlayed] = useState(mem.totalPlayed||0);
  const [flipped, setFlipped] = useState(false);
  const [current, setCurrent] = useState(null);
  const [nextCard, setNextCard] = useState(null);
  const [count, setCount] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [gone, setGone] = useState(false);
  const [goneDir, setGoneDir] = useState(1);
  const [deckExhausted, setDeckExhausted] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const dragStartX = useRef(null);
  const hasDragged = useRef(false);

  useEffect(()=>{saveMemory({seen:[...seenQuestions],totalPlayed,activeCats,hasSeenTutorial});},[seenQuestions,totalPlayed,activeCats,hasSeenTutorial]);

  const pool = buildPool(activeCats);
  const showPerspectiveToggle = relationshipType?(RELATIONSHIP_TYPES.find(r=>r.id===relationshipType)?.showToggle||false):false;
  const displayQuestion = current?(perspectiveFlipped?flipQuestion(current.question):current.question):"";
  const catData = current?CATEGORIES[current.category]:null;
  const cardBg = catData?.cardBg||"#F5EDE0";
  const cardBorder = catData?.cardBorder||"#E8DDD0";
  const unseenCount = pool.filter(q=>!seenQuestions.has(q.question)).length;

  const markSeen = useCallback((question)=>{setSeenQuestions(prev=>{const next=new Set(prev);next.add(question);return next;});setTotalPlayed(t=>t+1);},[]);

  const initPlay = useCallback((cats)=>{const usedCats=cats||activeCats;const p=buildPool(usedCats);if(!p.length)return;const first=pickNextUnseen(p,seenQuestions,"");const second=pickNextUnseen(p,seenQuestions,first?.question||"");setCurrent(first);setNextCard(second);setFlipped(false);setCount(1);setDragX(0);setGone(false);setIsDragging(false);setDeckExhausted(false);setScreen("play");},[activeCats,seenQuestions]);

  const advance = useCallback(()=>{if(!nextCard)return;if(current)markSeen(current.question);const p=buildPool(activeCats);const newSeen=new Set(seenQuestions);if(current)newSeen.add(current.question);const allSeen=p.every(q=>newSeen.has(q.question));if(allSeen){setCurrent(nextCard);setNextCard(null);setFlipped(false);setCount(c=>c+1);setDragX(0);setGone(false);setIsDragging(false);hasDragged.current=false;setPerspectiveFlipped(false);setDeckExhausted(true);return;}const upcoming=pickNextUnseen(p,newSeen,nextCard.question);setCurrent(nextCard);setNextCard(upcoming);setFlipped(false);setCount(c=>c+1);setDragX(0);setGone(false);setIsDragging(false);hasDragged.current=false;setPerspectiveFlipped(false);},[nextCard,current,activeCats,seenQuestions,markSeen]);

  const handleReset=()=>{setSeenQuestions(new Set());setTotalPlayed(0);setShowReset(false);setDeckExhausted(false);initPlay();};
  const handleCardTap=()=>{if(!flipped&&!hasDragged.current){audio.resume();audio.flip();setFlipped(true);}};
  const onPointerDown=(e)=>{if(!flipped)return;dragStartX.current=e.touches?e.touches[0].clientX:e.clientX;hasDragged.current=false;setIsDragging(true);};
  const onPointerMove=(e)=>{if(!isDragging||dragStartX.current===null)return;const x=(e.touches?e.touches[0].clientX:e.clientX)-dragStartX.current;if(Math.abs(x)>4)hasDragged.current=true;setDragX(x);};
  const onPointerUp=()=>{if(!isDragging)return;setIsDragging(false);if(Math.abs(dragX)>80){audio.resume();audio.swipe();setGoneDir(dragX>0?1:-1);setGone(true);setTimeout(advance,300);}else{setDragX(0);setTimeout(()=>{hasDragged.current=false;},50);}dragStartX.current=null;};
  const toggleCat=(cat)=>{setActiveCats(prev=>{if(prev.includes(cat)){if(prev.length<=1)return prev;return prev.filter(c=>c!==cat);}return[...prev,cat];});};

  // ── Go First serif style matching card face
  const GF_TITLE = {fontFamily:"'Playfair Display',serif",fontWeight:400,fontStyle:"italic"};

  return (
    <div style={{minHeight:"100vh",background:"#F0EAE0",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        html,body{overscroll-behavior:none;overflow:hidden;height:100%;background:#F0EAE0;-webkit-text-size-adjust:100%;}
        body{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);}
        #root{height:100%;overflow-y:auto;overscroll-behavior:none;-webkit-overflow-scrolling:touch;}
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;user-select:none;}
        .texture-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.1)!important;}
        .btn-back{background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:11px;color:#A08868;letter-spacing:0.1em;text-transform:uppercase;padding:0;}
        .tut-dot{height:6px;border-radius:3px;transition:all 0.3s;}
      `}</style>

      {/* ── HOME ── */}
      {screen==="home"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"0 24px 60px",width:"100%",maxWidth:460}}>
          <div style={{textAlign:"center",paddingTop:64,paddingBottom:40}}>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,letterSpacing:"0.22em",textTransform:"uppercase",color:"#A08868",marginBottom:12}}>Say the things we leave unsaid</p>
            <h1 style={{...GF_TITLE,fontSize:56,color:"#3C2010",lineHeight:1}}>Go First</h1>
            <div style={{width:32,height:1,background:"#C4905A",margin:"16px auto 0"}}/>
          </div>
          {/* Stacked cards */}
          <div style={{position:"relative",width:260,height:240,marginBottom:48}}>
            {[{rot:"-7deg",top:32,left:10,op:0.35,s:0.63},{rot:"4deg",top:16,left:22,op:0.6,s:0.65},{rot:"-1deg",top:0,left:16,op:1,s:0.67}].map((c,i)=>(
              <div key={i} style={{position:"absolute",top:c.top,left:c.left,width:228,height:320,transform:`rotate(${c.rot}) scale(${c.s})`,transformOrigin:"top center",opacity:c.op}}>
                <CardBack/>
              </div>
            ))}
          </div>
          <TextureButton onClick={()=>setScreen("deck")}>Build your deck</TextureButton>
          <p style={{marginTop:14,fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#C0A888",letterSpacing:"0.06em"}}>Choose your categories, then play</p>
          {totalPlayed>0&&<p style={{marginTop:10,fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#C8B8A0",letterSpacing:"0.04em"}}>{totalPlayed} question{totalPlayed!==1?"s":""} asked so far</p>}
        </div>
      )}

      {/* ── TUTORIAL ── */}
      {screen==="tutorial"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"24px 28px",width:"100%",maxWidth:420}}>
          <div style={{background:"#FBF5EC",border:"1.5px solid #DDD0BC",borderRadius:20,padding:"44px 32px",width:"100%",textAlign:"center",boxShadow:"0 8px 40px rgba(74,40,16,0.10)"}}>
            <div style={{marginBottom:24,display:"flex",justifyContent:"center"}}><TutIcon step={tutStep}/></div>
            <h2 style={{...GF_TITLE,fontSize:24,color:"#3C2010",marginBottom:14,lineHeight:1.3}}>{TUTORIAL_STEPS[tutStep].title}</h2>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"#7A5840",lineHeight:1.75,marginBottom:TUTORIAL_STEPS[tutStep].dare?16:32}}>{TUTORIAL_STEPS[tutStep].body}</p>
            {TUTORIAL_STEPS[tutStep].dare&&<p style={{...GF_TITLE,fontSize:20,color:"#3C2010",marginBottom:32}}>{TUTORIAL_STEPS[tutStep].dare}</p>}
            <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:28}}>
              {TUTORIAL_STEPS.map((_,i)=>{const stepColors=["#D4C4B0","#C4A882","#B8956A","#8B6445","#3C2410"];return<div key={i} className="tut-dot" style={{width:i===tutStep?20:6,background:i<=tutStep?stepColors[i]:"#E8DDD0"}}/>;})}</div>
            <TextureButton style={{width:"100%"}} onClick={()=>{if(tutStep<TUTORIAL_STEPS.length-1)setTutStep(t=>t+1);else{setHasSeenTutorial(true);initPlay();}}}>
              {tutStep<TUTORIAL_STEPS.length-1?"Next →":"Begin"}
            </TextureButton>
            {tutStep>0&&<button onClick={()=>setTutStep(t=>t-1)} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#B8A888",marginTop:14,display:"block",width:"100%"}}>← Back</button>}
          </div>
        </div>
      )}

      {/* ── DECK BUILDER ── */}
      {screen==="deck"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"0 20px 80px",width:"100%",maxWidth:460}}>
          <div style={{width:"100%",paddingTop:40,paddingBottom:24,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <button className="btn-back" onClick={()=>setScreen("home")}>← Back</button>
            <p style={{...GF_TITLE,fontSize:20,color:"#3C2010"}}>Go First</p>
            <div style={{width:48}}/>
          </div>
          <p style={{...GF_TITLE,fontSize:22,color:"#3C2010",textAlign:"center",marginBottom:8,lineHeight:1.4}}>Who are you playing with?</p>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#A08868",textAlign:"center",marginBottom:24}}>We'll suggest the right questions</p>
          <div style={{display:"flex",gap:10,width:"100%",marginBottom:32}}>
            {RELATIONSHIP_TYPES.map(rel=>(
              <RelTile key={rel.id} rel={rel} isActive={relationshipType===rel.id} onClick={()=>{setRelationshipType(rel.id);setActiveCats(rel.cats);}}/>
            ))}
          </div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#A08868",textAlign:"center",marginBottom:12,letterSpacing:"0.04em"}}>
            {relationshipType?"Fine tune your deck":"Or choose categories manually"}
          </p>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#C0A888",textAlign:"center",marginBottom:16}}>Lighter → heavier</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:32}}>
            {CATEGORY_ORDER.map(cat=>(
              <TexturePill key={cat} cat={cat} isOn={activeCats.includes(cat)} onClick={()=>toggleCat(cat)}/>
            ))}
          </div>
          <div style={{width:"100%",background:"#FBF5EC",border:"1px solid #DDD0BC",borderRadius:16,padding:"18px 22px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"inset 0 1px 3px rgba(0,0,0,0.06)"}}>
            <div>
              <p style={{...GF_TITLE,fontSize:18,color:"#3C2010",marginBottom:4}}>Your deck</p>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#A08868"}}>{unseenCount} unseen · {pool.length} total</p>
            </div>
            <div style={{display:"flex"}}>
              {activeCats.slice(0,4).map((cat,i)=><div key={cat} style={{width:26,height:34,borderRadius:4,background:CATEGORIES[cat]?.pillBg||"#8B6445",border:"2px solid #F0EAE0",marginLeft:i>0?-8:0,boxShadow:"0 2px 4px rgba(0,0,0,0.15)"}}/>)}
              {activeCats.length>4&&<div style={{width:26,height:34,borderRadius:4,background:"#C0A888",border:"2px solid #F0EAE0",marginLeft:-8,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 4px rgba(0,0,0,0.15)"}}><span style={{fontSize:9,color:"white",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>+{activeCats.length-4}</span></div>}
            </div>
          </div>
          {seenQuestions.size>0&&(
            <TextureButton variant="ghost" style={{marginBottom:24,padding:"12px 32px"}} onClick={()=>setShowReset(true)}>
              Reset progress · {seenQuestions.size} seen
            </TextureButton>
          )}
          <TextureButton disabled={pool.length===0} onClick={()=>{if(!hasSeenTutorial){setTutStep(0);setScreen("tutorial");}else{initPlay();}}}>
            Play · {unseenCount} new questions
          </TextureButton>
        </div>
      )}

      {/* ── RESET MODAL ── */}
      {showReset&&(
        <div style={{position:"fixed",inset:0,background:"rgba(44,35,24,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24}}>
          <div style={{background:"#FBF5EC",borderRadius:20,padding:"40px 32px",width:"100%",maxWidth:340,textAlign:"center"}}>
            <p style={{...GF_TITLE,fontSize:22,color:"#3C2010",marginBottom:12}}>Start fresh?</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840",lineHeight:1.7,marginBottom:28}}>You've asked {seenQuestions.size} question{seenQuestions.size!==1?"s":""}. Reset will let you experience them all again.</p>
            <TextureButton style={{width:"100%",marginBottom:12}} onClick={handleReset}>Yes, start fresh</TextureButton>
            <TextureButton variant="ghost" style={{width:"100%",padding:"14px 32px"}} onClick={()=>setShowReset(false)}>Keep my progress</TextureButton>
          </div>
        </div>
      )}

      {/* ── PLAY ── */}
      {screen==="play"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"0 12px 40px",width:"100%",maxWidth:460,minHeight:"100vh"}}>
          <div style={{width:"100%",paddingTop:36,paddingBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <button className="btn-back" onClick={()=>setScreen("deck")}>← Decks</button>
            <p style={{...GF_TITLE,fontSize:18,color:"#3C2010"}}>Go First</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#C0A888",letterSpacing:"0.08em",minWidth:40,textAlign:"right"}}>{count}</p>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center",marginBottom:20,width:"100%"}}>
            {CATEGORY_ORDER.map(cat=>(
              <TexturePill key={cat} cat={cat} isOn={activeCats.includes(cat)} onClick={()=>toggleCat(cat)} size="small"/>
            ))}
          </div>
          {/* Card stack */}
          <div style={{position:"relative",width:"100%",maxWidth:360,height:504,marginBottom:20}}>
            {nextCard&&!deckExhausted&&(
              <div style={{position:"absolute",inset:0,transform:"scale(0.95) translateY(10px)",transformOrigin:"bottom center",opacity:1,pointerEvents:"none",zIndex:1}}>
                <CardBack/>
              </div>
            )}
            {deckExhausted&&(
              <div style={{position:"absolute",inset:0,zIndex:2,background:"#F5EDE0",border:`1.5px solid #E8DDD0`,borderRadius:20,padding:"40px 32px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",boxShadow:"0 8px 40px rgba(74,40,16,0.12)"}}>
                <div style={{position:"absolute",inset:10,border:"1px solid rgba(180,160,140,0.25)",borderRadius:12,pointerEvents:"none"}}/>
                <p style={{...GF_TITLE,fontSize:28,color:"#3C2010",lineHeight:1.4,marginBottom:16}}>You've asked it all.</p>
                <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#A08868",lineHeight:1.7,marginBottom:32}}>Every question in your deck has been asked. The conversations you've had are the ones worth having.</p>
                <TextureButton variant="ghost" style={{padding:"12px 32px"}} onClick={()=>setShowReset(true)}>Start fresh</TextureButton>
              </div>
            )}
            {current&&!deckExhausted&&(
              <div
                key={current.question}
                style={{position:"absolute",inset:0,zIndex:2,
                  transform:gone?`translateX(${goneDir*110}vw) rotate(${goneDir*18}deg)`:`translateX(${dragX}px) rotate(${dragX*0.025}deg)`,
                  transition:isDragging?"none":gone?"transform 0.28s ease-in":"transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
                  cursor:flipped?"grab":"pointer",touchAction:"pan-y",
                }}
                onClick={handleCardTap}
                onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
              >
                {/* Card back face */}
                <div style={{position:"absolute",inset:0,opacity:flipped?0:1,transform:flipped?"scale(0.94)":"scale(1)",transition:isDragging?"none":"opacity 0.22s ease, transform 0.22s ease",pointerEvents:flipped?"none":"auto"}}>
                  <CardBack/>
                </div>
                {/* Question face */}
                <div style={{position:"absolute",inset:0,opacity:flipped?1:0,transform:flipped?"scale(1)":"scale(0.94)",
                  transition:isDragging?"none":"opacity 0.22s ease 0.08s, transform 0.22s ease 0.08s",
                  background:cardBg,border:`1.5px solid ${cardBorder}`,borderRadius:20,padding:"34px 28px",
                  display:"flex",flexDirection:"column",justifyContent:"space-between",
                  boxShadow:"0 8px 40px rgba(74,40,16,0.12)",pointerEvents:flipped?"auto":"none"}}>
                  <div style={{position:"absolute",inset:10,border:"1px solid rgba(180,160,140,0.25)",borderRadius:12,pointerEvents:"none"}}/>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:"#3C2410",flexShrink:0}}/>
                      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,letterSpacing:"0.18em",textTransform:"uppercase",color:"#3C2410",opacity:0.6}}>{current.category}</p>
                    </div>
                    {showPerspectiveToggle&&(
                      <button onClick={(e)=>{e.stopPropagation();setPerspectiveFlipped(v=>!v);}} style={{background:perspectiveFlipped?"#3C2410":"transparent",border:"1px solid #C4A882",borderRadius:100,padding:"3px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"all 0.2s"}}>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,letterSpacing:"0.08em",color:perspectiveFlipped?"#F5EDD9":"#8B6445",fontWeight:500}}>{perspectiveFlipped?"About you":"About me"}</span>
                      </button>
                    )}
                  </div>
                  <p style={{...GF_TITLE,fontStyle:"italic",fontSize:displayQuestion.length>90?19:displayQuestion.length>65?22:25,lineHeight:1.55,color:"#2C1808",flex:1,display:"flex",alignItems:"center",paddingTop:14}}>
                    {displayQuestion}
                  </p>
                  <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#3C2410",opacity:0.3,letterSpacing:"0.1em"}}>— {count}</p>
                </div>
              </div>
            )}
          </div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#C0A888",letterSpacing:"0.06em",textAlign:"center",minHeight:18}}>
            {deckExhausted?"":!flipped?"Tap to reveal":Math.abs(dragX)>40?"Let go to discard":"Swipe left or right when you're done"}
          </p>
          <p style={{marginTop:8,fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#D0C4B4",letterSpacing:"0.06em"}}>{unseenCount} unseen · {totalPlayed} played</p>
        </div>
      )}
    </div>
  );
}
