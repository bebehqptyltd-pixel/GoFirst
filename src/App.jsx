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
const STORAGE_KEY = "gofirst_v2";
function loadMemory(){try{const r=localStorage.getItem(STORAGE_KEY);if(!r)return{seen:[],totalPlayed:0,activeCats:null,hasSeenTutorial:false};return JSON.parse(r);}catch{return{seen:[],totalPlayed:0,activeCats:null,hasSeenTutorial:false};}}
function saveMemory(m){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(m));}catch{}}

// ── Card back ────────────────────────────────────────────────
function CardBack() {
  return (
    <div style={{width:"100%",height:"100%",borderRadius:20,overflow:"hidden",boxShadow:"-4px 12px 40px rgba(54,28,8,0.22), -2px 6px 16px rgba(54,28,8,0.14), -1px 2px 4px rgba(54,28,8,0.08)"}}>
      <img src="https://i.imgur.com/RFAJysA.png" alt="" draggable="false" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
    </div>
  );
}

// ── Flame icon ───────────────────────────────────────────────
function FlameIcon({ size=13, color="#B84A1A" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c0 0-4 4-4 8.5C8 14 9.5 16 12 17c2.5-1 4-3 4-6.5C16 6 12 2 12 2z"/>
      <path d="M12 17c0 0-3 1.5-3 4 0 1.7 1.3 3 3 3s3-1.3 3-3c0-2.5-3-4-3-4z"/>
    </svg>
  );
}

// ── Spicy badge ──────────────────────────────────────────────
function SpicyBadge({ level }) {
  if (!level || level === 0) return null;
  const colors = { 1:"#C4783A", 2:"#B85A20", 3:"#8B2800" };
  const col = colors[level] || "#C4783A";
  return (
    <div style={{display:"flex",alignItems:"center",gap:3}}>
      <FlameIcon size={12} color={col}/>
      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:600,color:col,letterSpacing:"0.06em"}}>{level}</span>
    </div>
  );
}

// ── Info icon ────────────────────────────────────────────────
function InfoIcon({ color="#A08868" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}

// ── Question data ────────────────────────────────────────────
// Shape: { question, perspectiveQ, category, stage, spicy, canFlip }
const ALL_QUESTIONS = [
  // ── Starter ──
  {question:"What did you assume about me that turned out to be completely wrong?",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a moment that quietly changed you?",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  {question:"What do you think my biggest blind spot is?",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you've never felt fully understood about?",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  {question:"What's your most controversial food opinion?",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  {question:"What do you hope love feels like years from now?",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  {question:"Tell me about a time you stood up for something and it cost you.",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  {question:"What version of yourself comes out in relationships?",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  {question:"What would your villain origin story be?",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  {question:"What are you still healing from?",perspectiveQ:null,category:"Starter",stage:"friends",spicy:0,canFlip:false},
  // ── Playful & Funny ──
  {question:"What's the dumbest injury you've ever had?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's your most irrational fear?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you were convinced of as a kid that was completely wrong?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's your most useless talent?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's your weirdest habit when nobody is watching?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a hill you'll die on for absolutely no reason?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"If your life had a warning label, what would it say?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a film or show you're embarrassed to admit you love?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's the worst advice you've ever confidently given someone?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a phrase or word you say too much?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's the most chaotic decision you've ever made on a whim?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you owned as a kid that you'd be mortified by now?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a completely unhinged rule you have for yourself?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"If your pet had to describe you to a stranger, what would they say?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a completely made-up skill you've pretended to have?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's the most ridiculous thing you've ever argued about?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's the pettiest thing you've ever done and felt zero guilt about?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you're weirdly competitive about?",perspectiveQ:null,category:"Playful & Funny",stage:"friends",spicy:0,canFlip:false},
  // ── Story Questions ──
  {question:"Tell me about one of the best days of your life.",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"Tell me about a moment you laughed so hard you couldn't breathe.",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a memory you wish you could relive for one hour?",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"Tell me about a time everything went spectacularly wrong.",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a random memory you think about more than you should?",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a tiny childhood memory you still remember vividly?",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"Tell me about a time you felt deeply proud of yourself.",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a memory that still makes you emotional?",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"Tell me about a moment you felt truly free.",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"Tell me about a stranger who made a surprising impact on you.",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a decision you made that turned out way better than expected?",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"Tell me about a time you surprised yourself.",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a moment where you realised you'd changed?",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"Tell me about the last time you were genuinely moved by something.",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a mistake you'd actually make again?",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"Tell me about a friendship that shaped who you are.",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you did that took more courage than people realised?",perspectiveQ:null,category:"Story Questions",stage:"friends",spicy:0,canFlip:false},
  // ── Attraction & Chemistry ──
  {question:"What's something non-sexual you find incredibly attractive?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"When did you first realise you were attracted to me?",perspectiveQ:"When do you think I first realised I was attracted to you?",category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:true},
  {question:"What kind of touch comes naturally to you?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What kind of affection makes you melt?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What's your ideal slow Sunday together?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What kind of moments make you want to kiss someone?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What creates chemistry for you beyond physical attraction?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What's something subtle someone can do that drives you wild?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What kind of intimacy matters most to you?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What's something about how someone carries themselves that draws you in?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What's a quality in someone that sneaks up on you over time?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What do you notice about someone before you notice anything else?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What makes you feel truly seen by another person?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What kind of conversation gives you that electric feeling?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What does flirting look like to you when it's done well?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What makes you feel genuinely confident around someone?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  {question:"What's something you find attractive that you've never really told anyone?",perspectiveQ:null,category:"Attraction & Chemistry",stage:"just_together",spicy:0,canFlip:false},
  // ── Honest Impressions ──
  {question:"What did you think I was like before you actually knew me?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something about me you still haven't figured out?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What do you think I need more of in my life?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you've noticed about me that I probably don't see in myself?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you think we have in common that might surprise me?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you want me to know about you that I might have wrong?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's the version of you that most people don't get to see?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What do people assume about you based on how you look or come across?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you do that people misread?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something about me you were initially unsure about?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a question you've wanted to ask me but haven't yet?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's your honest first impression of me, now that it's safe to say?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you think I'm better at than I give myself credit for?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  {question:"What do you think I'm like when things get hard?",perspectiveQ:null,category:"Honest Impressions",stage:"friends",spicy:0,canFlip:false},
  // ── Life & Values ──
  {question:"What matters most to you in life now?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What kind of life are you trying to build?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What does commitment mean to you?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What kind of partner do you want to be?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What does a really good ordinary life look like to you?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What are your non-negotiables in relationships?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What kind of home environment makes you happiest?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What do you think makes relationships last?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What scares you most about relationships?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What kind of future feels exciting to you?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you used to want that you no longer care about?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What's a value you hold that most people in your life don't share?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What does success look like to you right now, honestly?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What would you do differently if you weren't worried about what people thought?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What chapter of your life are you in right now?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What's something you hope you never compromise on?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"Who has shaped your idea of what love should look like?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  {question:"What kind of person do you want to have become in ten years?",perspectiveQ:null,category:"Life & Values",stage:"friends",spicy:0,canFlip:false},
  // ── Emotional Intimacy ──
  {question:"When do you feel most emotionally safe?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What makes somewhere feel like home to you?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What helps you feel calm when life is overwhelming?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What makes you shut down emotionally?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What kind of people make you feel safe?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What's something you wish more people understood about you?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What do you need most when you're stressed?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What makes you feel deeply loved?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What kind of relationship dynamic feels healthiest to you?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What's something you protect fiercely in your life?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What do you do when you need to process something hard?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"How do you know when you actually trust someone?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What does it look like when you're at your worst, and what do you need then?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What's something you've had to unlearn about how to love people?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What's a boundary you've set that changed your life?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What's something you've forgiven someone for that took a long time?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What do you wish you were better at emotionally?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  {question:"What's a version of yourself you've had to leave behind?",perspectiveQ:null,category:"Emotional Intimacy",stage:"were_a_thing",spicy:0,canFlip:false},
  // ── Late Night ──
  {question:"What do you think love should feel like?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What part of yourself do you struggle to show people?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What kind of relationship do you never want to repeat?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"When do you feel most connected to someone?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What does emotional loyalty mean to you?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What kind of relationship would make life feel softer?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What do you think about when you can't sleep?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What's the difference between being happy and being at peace?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What do you think love asks of us that we're not always ready for?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What's something you hope someone thinks about when they think about you?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What do you think is the hardest part of being human?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
  {question:"What's something beautiful you've found in something painful?",perspectiveQ:null,category:"Late Night",stage:"committed",spicy:0,canFlip:false},
];

const CATEGORY_ORDER = ["Starter","Playful & Funny","Story Questions","Attraction & Chemistry","Honest Impressions","Life & Values","Emotional Intimacy","Late Night"];

const CATEGORIES = {
  "Starter":               {pillBg:"#D4C4B0",pillText:"#3C2410",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Playful & Funny":       {pillBg:"#C4A882",pillText:"#3C2410",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Story Questions":       {pillBg:"#B8956A",pillText:"#3C2410",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Attraction & Chemistry":{pillBg:"#A67D55",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Honest Impressions":    {pillBg:"#8B6445",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Life & Values":         {pillBg:"#6B4A30",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Emotional Intimacy":    {pillBg:"#52371E",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Late Night":            {pillBg:"#3C2410",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
};

// ── Relationship stage icons ─────────────────────────────────
const REL_ICONS = {
  friends: (col) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="6" r="3"/>
      <circle cx="16" cy="6" r="3"/>
      <path d="M2 20c0-3.3 2.7-5 6-5h1"/>
      <path d="M11 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/>
    </svg>
  ),
  just_together: (col) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"/>
    </svg>
  ),
  were_a_thing: (col) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  committed: (col) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="12" r="5"/>
      <circle cx="16" cy="12" r="5"/>
    </svg>
  ),
};

const RELATIONSHIP_TYPES = [
  {id:"friends",       label:"Friends",       description:"Deepen a friendship",  cats:["Starter","Playful & Funny","Story Questions","Honest Impressions","Life & Values"],          spicyMax:0},
  {id:"just_together", label:"Just Together", description:"Early days",            cats:["Starter","Playful & Funny","Attraction & Chemistry","Honest Impressions","Story Questions"], spicyMax:1},
  {id:"were_a_thing",  label:"We're a Thing", description:"In a relationship",    cats:["Attraction & Chemistry","Honest Impressions","Emotional Intimacy","Life & Values","Story Questions"], spicyMax:2},
  {id:"committed",     label:"Committed",     description:"Long term or married",  cats:["Emotional Intimacy","Life & Values","Late Night","Honest Impressions","Attraction & Chemistry"], spicyMax:3},
];

const TUTORIAL_STEPS = [
  {title:"Welcome to Go First",  body:"A card game for people brave enough to say the things typically left unsaid.",            dare:null},
  {title:"Tap to reveal",        body:"Each card starts face down. Tap it when you're ready to flip and reveal the question.",  dare:null},
  {title:"Answer honestly",      body:"Take turns answering. There are no right answers — just yours.",                          dare:null},
  {title:"Swipe to move on",     body:"When you're done with a question, swipe left or right to move to the next card.",       dare:null},
  {title:"Play it your way",     body:"Choose your relationship stage and fine-tune your categories at any time. Turn the heat up when you're ready — spicy questions unlock as you go deeper.", dare:"Who will Go First?"},
];

function flipQuestion(q){
  if(!q)return q;
  return q.replace(/\bdo you find\b/gi,"do I find").replace(/\bdo you\b/gi,"do I").replace(/\byou find\b/gi,"I find").replace(/\byou feel\b/gi,"I feel").replace(/\byou need\b/gi,"I need").replace(/\byou want\b/gi,"I want").replace(/\byou think\b/gi,"I think").replace(/\byou wish\b/gi,"I wish").replace(/\byou love\b/gi,"I love").replace(/\byour\b/gi,"my").replace(/\bYour\b/g,"My").replace(/\byou\b/gi,"I").replace(/\bYou\b/g,"I").replace(/\bI I\b/g,"I").trim();
}

function buildPool(activeCats, stageId, spicyUnlocked) {
  const stageConfig = RELATIONSHIP_TYPES.find(r=>r.id===stageId);
  const maxSpicy = spicyUnlocked ? (stageConfig?.spicyMax||0) : 0;
  return ALL_QUESTIONS.filter(q => {
    if (!activeCats.includes(q.category)) return false;
    if (stageId && q.stage !== stageId) return false;
    if (q.spicy > 0 && q.spicy > maxSpicy) return false;
    return true;
  });
}

function pickNextUnseen(pool,seenSet,excludeQ){
  const unseen=pool.filter(q=>!seenSet.has(q.question)&&q.question!==excludeQ);
  if(unseen.length>0)return unseen[Math.floor(Math.random()*unseen.length)];
  const fallback=pool.filter(q=>q.question!==excludeQ);
  return fallback.length>0?fallback[Math.floor(Math.random()*fallback.length)]:pool[0];
}

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
      cursor:"pointer", display:"inline-flex", alignItems:"center",
      fontFamily:"'DM Sans',sans-serif", fontSize: small ? 11 : 12,
      fontWeight:500, letterSpacing:"0.04em", whiteSpace:"nowrap",
      color: isOn ? d.pillText : "#5C4030",
      background: isOn ? d.pillBg : "transparent",
      opacity: isOn ? 1 : 0.9, transition:"all 0.2s",
      boxShadow: isOn ? `-1px 3px 8px rgba(54,28,8,0.18), inset 0 1px 0 rgba(255,255,255,0.2)` : "none",
    }}>
      {isOn && (
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.18,pointerEvents:"none"}} viewBox="0 0 200 40" preserveAspectRatio="xMidYMid slice">
          <filter id={`pf-${cat.replace(/[\s&]/g,"")}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="200" height="40" filter={`url(#pf-${cat.replace(/[\s&]/g,"")})`} fill="white"/>
        </svg>
      )}
      <span style={{position:"relative"}}>{cat}</span>
    </button>
  );
}

function TextureButton({onClick, disabled, children, style={}, variant="dark"}) {
  const bg = variant === "dark" ? "#5C3418" : "#F5EDE0";
  const color = variant === "dark" ? "#F5EDD9" : "#5C3418";
  return (
    <button onClick={onClick} disabled={disabled} className="texture-btn" style={{
      position:"relative", overflow:"hidden",
      background: variant === "ghost" ? "transparent" : bg, color,
      border: variant === "ghost" ? "1.5px solid #C4A882" : "none",
      borderRadius:100, padding:"16px 48px",
      fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:500,
      letterSpacing:"0.14em", textTransform:"uppercase",
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
      boxShadow: variant === "ghost" ? "none" : `-2px 4px 12px rgba(54,28,8,0.28), inset 0 1px 0 rgba(255,255,255,0.12)`,
      transition:"all 0.15s", ...style,
    }}>
      {variant !== "ghost" && (
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.12,pointerEvents:"none"}} viewBox="0 0 300 52" preserveAspectRatio="xMidYMid slice">
          <filter id="pf-btn"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
          <rect width="300" height="52" filter="url(#pf-btn)" fill="white"/>
        </svg>
      )}
      <span style={{position:"relative"}}>{children}</span>
    </button>
  );
}

function RelTile({rel, isActive, onClick}) {
  return (
    <button onClick={onClick} style={{
      position:"relative", overflow:"hidden",
      background: isActive ? "#3C2010" : "#FBF5EC",
      border: `1.5px solid ${isActive ? "#3C2010" : "#DDD0BC"}`,
      borderRadius:16, padding:"14px 8px",
      cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6,
      transition:"all 0.2s", minWidth:0, flex:1,
      boxShadow: isActive ? `-3px 8px 24px rgba(54,28,8,0.30), inset 0 1px 0 rgba(255,255,255,0.08)` : `-1px 3px 8px rgba(54,28,8,0.10), inset 0 1px 0 rgba(255,255,255,0.7)`,
    }}>
      {isActive && (
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.1,pointerEvents:"none"}} viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
          <filter id="pf-rel"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
          <rect width="160" height="90" filter="url(#pf-rel)" fill="white"/>
        </svg>
      )}
      <span style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {REL_ICONS[rel.id]?.(isActive?"#F5EDD9":"#5C3418")}
      </span>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:500,color:isActive?"#F5EDD9":"#3C2010",letterSpacing:"0.02em",textAlign:"center",lineHeight:1.25,position:"relative"}}>{rel.label}</p>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:isActive?"#D4B882":"#6B4A30",position:"relative",fontWeight:400,textAlign:"center"}}>{rel.description}</p>
    </button>
  );
}

function SpicyToggle({ enabled, onToggle, stageId }) {
  const stage = RELATIONSHIP_TYPES.find(r=>r.id===stageId);
  if (!stage || stage.spicyMax === 0) return null;
  const levelLabel = stage.spicyMax === 1 ? "Warm" : stage.spicyMax === 2 ? "Medium" : "All levels";
  return (
    <button onClick={onToggle} style={{
      display:"flex", alignItems:"center", gap:8,
      background: enabled ? "#3C2010" : "transparent",
      border:`1.5px solid ${enabled?"#3C2010":"#C4A882"}`,
      borderRadius:100, padding:"8px 18px", cursor:"pointer", transition:"all 0.2s",
      boxShadow: enabled ? `-1px 3px 8px rgba(54,28,8,0.20)` : "none",
    }}>
      <FlameIcon size={13} color={enabled?"#F5A050":"#8B6445"}/>
      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:500,letterSpacing:"0.06em",color:enabled?"#F5EDD9":"#7A5840"}}>
        {enabled ? `Spicy on · ${levelLabel}` : "Turn up the heat"}
      </span>
    </button>
  );
}

function TutIcon({step}){
  const p={stroke:"#7A4A24",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round",fill:"none"};
  if(step===0)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="6" y="8" width="24" height="30" rx="3" {...p}/><rect x="12" y="4" width="24" height="30" rx="3" {...p}/><line x1="18" y1="17" x2="28" y2="17" {...p}/><line x1="18" y1="22" x2="24" y2="22" {...p}/></svg>;
  if(step===1)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="10" y="4" width="24" height="32" rx="3" {...p}/><path d="M22 14 L22 24 M17 20 L22 25 L27 20" {...p}/></svg>;
  if(step===2)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M6 10 Q6 6 10 6 L34 6 Q38 6 38 10 L38 24 Q38 28 34 28 L24 28 L16 36 L16 28 L10 28 Q6 28 6 24 Z" {...p}/><line x1="13" y1="15" x2="31" y2="15" {...p}/><line x1="13" y1="20" x2="24" y2="20" {...p}/></svg>;
  if(step===3)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="12" y="6" width="20" height="28" rx="3" {...p}/><path d="M4 20 L2 20 M6 16 L2 20 L6 24" {...p}/><path d="M40 20 L42 20 M38 16 L42 20 L38 24" {...p}/></svg>;
  if(step===4)return<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M22 8 c0 0-6 5-6 10.5C16 22.5 18.2 25 22 26.5c3.8-1.5 6-4 6-8C28 13 22 8 22 8z" {...p}/><path d="M22 26.5 c0 0-4 2-4 5.5 0 2.2 1.8 4 4 4s4-1.8 4-4 c0-3.5-4-5.5-4-5.5z" {...p}/></svg>;
  return null;
}

export default function App() {
  const mem = loadMemory();
  const [screen, setScreen] = useState("home");
  const [tutStep, setTutStep] = useState(0);
  const [tutorialFrom, setTutorialFrom] = useState("home");
  const [hasSeenTutorial, setHasSeenTutorial] = useState(mem.hasSeenTutorial||false);
  const [activeCats, setActiveCats] = useState(mem.activeCats||[...CATEGORY_ORDER]);
  const [relationshipType, setRelationshipType] = useState(null);
  const [spicyUnlocked, setSpicyUnlocked] = useState(false);
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
  const [showInfo, setShowInfo] = useState(false);
  const dragStartX = useRef(null);
  const hasDragged = useRef(false);

  useEffect(()=>{saveMemory({seen:[...seenQuestions],totalPlayed,activeCats,hasSeenTutorial});},[seenQuestions,totalPlayed,activeCats,hasSeenTutorial]);

  const GF_TITLE = {fontFamily:"'Cormorant Garamond',serif",fontWeight:400,fontStyle:"normal"};

  const pool = buildPool(activeCats, relationshipType, spicyUnlocked);
  const currentStage = RELATIONSHIP_TYPES.find(r=>r.id===relationshipType);
  const showPerspectiveToggle = !!(current?.canFlip && (relationshipType==="were_a_thing"||relationshipType==="committed"));
  const displayQuestion = current ? (perspectiveFlipped && current.perspectiveQ ? current.perspectiveQ : current.question) : "";
  const catData = current ? CATEGORIES[current.category] : null;
  const cardBg = catData?.cardBg||"#F5EDE0";
  const cardBorder = catData?.cardBorder||"#E8DDD0";
  const unseenCount = pool.filter(q=>!seenQuestions.has(q.question)).length;

  const markSeen = useCallback((question)=>{setSeenQuestions(prev=>{const next=new Set(prev);next.add(question);return next;});setTotalPlayed(t=>t+1);},[]);

  const initPlay = useCallback((cats)=>{
    const usedCats=cats||activeCats;
    const p=buildPool(usedCats,relationshipType,spicyUnlocked);
    if(!p.length)return;
    const first=pickNextUnseen(p,seenQuestions,"");
    const second=pickNextUnseen(p,seenQuestions,first?.question||"");
    setCurrent(first);setNextCard(second);setFlipped(false);setCount(1);setDragX(0);setGone(false);setIsDragging(false);setDeckExhausted(false);setScreen("play");
  },[activeCats,seenQuestions,relationshipType,spicyUnlocked]);

  const advance = useCallback(()=>{
    if(!nextCard)return;
    if(current)markSeen(current.question);
    const p=buildPool(activeCats,relationshipType,spicyUnlocked);
    const newSeen=new Set(seenQuestions);
    if(current)newSeen.add(current.question);
    const allSeen=p.every(q=>newSeen.has(q.question));
    if(allSeen){setCurrent(nextCard);setNextCard(null);setFlipped(false);setCount(c=>c+1);setDragX(0);setGone(false);setIsDragging(false);hasDragged.current=false;setPerspectiveFlipped(false);setDeckExhausted(true);return;}
    const upcoming=pickNextUnseen(p,newSeen,nextCard.question);
    setCurrent(nextCard);setNextCard(upcoming);setFlipped(false);setCount(c=>c+1);setDragX(0);setGone(false);setIsDragging(false);hasDragged.current=false;setPerspectiveFlipped(false);
  },[nextCard,current,activeCats,seenQuestions,markSeen,relationshipType,spicyUnlocked]);

  const handleReset=()=>{setSeenQuestions(new Set());setTotalPlayed(0);setShowReset(false);setDeckExhausted(false);initPlay();};
  const handleCardTap=()=>{if(!flipped&&!hasDragged.current){audio.resume();audio.flip();setFlipped(true);}};
  const onPointerDown=(e)=>{if(!flipped)return;dragStartX.current=e.touches?e.touches[0].clientX:e.clientX;hasDragged.current=false;setIsDragging(true);};
  const onPointerMove=(e)=>{if(!isDragging||dragStartX.current===null)return;const x=(e.touches?e.touches[0].clientX:e.clientX)-dragStartX.current;if(Math.abs(x)>4)hasDragged.current=true;setDragX(x);};
  const onPointerUp=()=>{if(!isDragging)return;setIsDragging(false);if(Math.abs(dragX)>80){audio.resume();audio.swipe();setGoneDir(dragX>0?1:-1);setGone(true);setTimeout(advance,300);}else{setDragX(0);setTimeout(()=>{hasDragged.current=false;},50);}dragStartX.current=null;};
  const toggleCat=(cat)=>{setActiveCats(prev=>{if(prev.includes(cat)){if(prev.length<=1)return prev;return prev.filter(c=>c!==cat);}return[...prev,cat];});};
  const openInfo = () => setShowInfo(true);
  const replayTutorial = () => { setShowInfo(false); setTutStep(0); setTutorialFrom("info"); setScreen("tutorial"); };

  return (
    <div style={{minHeight:"100vh",background:"#F0EAE0",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@300;400;500&display=swap');
        html,body{overscroll-behavior:none;overflow:hidden;height:100%;background:#F0EAE0;-webkit-text-size-adjust:100%;}
        body{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);}
        #root{height:100%;overflow-y:auto;overscroll-behavior:none;-webkit-overflow-scrolling:touch;}
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;user-select:none;}
        .texture-btn:active{transform:translateY(2px);box-shadow:-1px 2px 4px rgba(54,28,8,0.16),inset 0 1px 0 rgba(255,255,255,0.08)!important;}
        .btn-icon{background:none;border:none;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;opacity:0.6;transition:opacity 0.2s;}
        .btn-icon:hover{opacity:1;}
        .btn-back-arrow{background:none;border:none;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;opacity:0.6;transition:opacity 0.2s;}
        .btn-back-arrow:hover{opacity:1;}
        .tut-dot{height:6px;border-radius:3px;transition:all 0.3s;}
      `}</style>

      {/* ── PERSISTENT INFO BUTTON ── */}
      {!showInfo && !showReset && (
        <div style={{position:"fixed",top:"calc(env(safe-area-inset-top) + 12px)",right:14,zIndex:50,pointerEvents:"auto"}}>
          <button className="btn-icon" onClick={openInfo}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A08868" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── INFO MODAL ── */}
      {showInfo&&(
        <div style={{position:"fixed",inset:0,background:"rgba(44,35,24,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24}}>
          <div style={{background:"#FBF5EC",borderRadius:20,padding:"40px 32px",width:"100%",maxWidth:340,textAlign:"center"}}>
            <p style={{...GF_TITLE,fontSize:24,color:"#3C2010",marginBottom:8}}>Go First</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840",lineHeight:1.7,marginBottom:28}}>Need a reminder of how it works, or want to start fresh?</p>
            <TextureButton style={{width:"100%",marginBottom:12}} onClick={replayTutorial}>How to play</TextureButton>
            <TextureButton variant="ghost" style={{width:"100%",padding:"14px 32px",marginBottom:12}} onClick={()=>{setShowInfo(false);setShowReset(true);}}>
              Reset progress{seenQuestions.size>0?` · ${seenQuestions.size} seen`:""}
            </TextureButton>
            <button onClick={()=>setShowInfo(false)} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#B8A888",marginTop:4,display:"block",width:"100%"}}>Close</button>
          </div>
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

      {/* ── HOME ── */}
      {screen==="home"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:460,boxSizing:"border-box",paddingLeft:24,paddingRight:24,paddingTop:"calc(env(safe-area-inset-top) + 52px)",paddingBottom:"calc(env(safe-area-inset-bottom) + 24px)"}}>
          {/* Title + tagline */}
          <div style={{textAlign:"center"}}>
            <h1 style={{...GF_TITLE,fontSize:54,color:"#3C2010",lineHeight:1}}>Go First</h1>
            <p style={{...GF_TITLE,marginTop:8,fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase",color:"#A08868"}}>Say the things we leave unsaid</p>
          </div>
          {/* 60px gap tagline to card */}
          <div style={{height:60}}/>
          {/* Card fan */}
          <div style={{position:"relative",width:260,height:353,alignSelf:"center"}}>
            {[
              {rot:"-7deg", top:20,  left:-6, op:0.3, w:234, h:328},
              {rot:"4deg",  top:10,  left:2,  op:0.6, w:244, h:342},
              {rot:"-1deg", top:0,   left:-2, op:1,   w:252, h:353},
            ].map((c,i)=>(
              <div key={i} style={{position:"absolute",top:c.top,left:c.left,width:c.w,height:c.h,transform:`rotate(${c.rot})`,transformOrigin:"top center",opacity:c.op}}>
                <CardBack/>
              </div>
            ))}
          </div>
          {/* 60px gap card to button */}
          <div style={{height:60}}/>
          {/* CTA */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <TextureButton onClick={()=>setScreen("deck")}>Build your deck</TextureButton>
            {totalPlayed>0&&<p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#C8B8A0",letterSpacing:"0.04em"}}>{totalPlayed} question{totalPlayed!==1?"s":""} asked so far</p>}
          </div>
        </div>
      )}

      {/* ── TUTORIAL ── */}
      {screen==="tutorial"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"24px 28px",width:"100%",maxWidth:420}}>
          <div style={{background:"#FBF5EC",border:"1.5px solid #DDD0BC",borderRadius:20,padding:"44px 32px",width:"100%",textAlign:"center",boxShadow:"-3px 10px 36px rgba(54,28,8,0.12), -1px 3px 8px rgba(54,28,8,0.08)"}}>
            <div style={{marginBottom:24,display:"flex",justifyContent:"center"}}><TutIcon step={tutStep}/></div>
            <h2 style={{...GF_TITLE,fontSize:24,color:"#3C2010",marginBottom:14,lineHeight:1.3}}>{TUTORIAL_STEPS[tutStep].title}</h2>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"#7A5840",lineHeight:1.75,marginBottom:TUTORIAL_STEPS[tutStep].dare?16:32}}>{TUTORIAL_STEPS[tutStep].body}</p>
            {TUTORIAL_STEPS[tutStep].dare&&<p style={{...GF_TITLE,fontSize:20,color:"#3C2010",marginBottom:32}}>{TUTORIAL_STEPS[tutStep].dare}</p>}
            <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:28}}>
              {TUTORIAL_STEPS.map((_,i)=>{const stepColors=["#D4C4B0","#C4A882","#B8956A","#8B6445","#3C2410"];return<div key={i} className="tut-dot" style={{width:i===tutStep?20:6,background:i<=tutStep?stepColors[i]:"#E8DDD0"}}/>;})}</div>
            <TextureButton style={{width:"100%"}} onClick={()=>{
              if(tutStep<TUTORIAL_STEPS.length-1){setTutStep(t=>t+1);}
              else{setHasSeenTutorial(true);if(tutorialFrom==="info"){setScreen("home");}else{initPlay();}}
            }}>
              {tutStep<TUTORIAL_STEPS.length-1?"Next →":"Begin"}
            </TextureButton>
            {tutStep>0&&<button onClick={()=>setTutStep(t=>t-1)} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#B8A888",marginTop:14,display:"block",width:"100%"}}>← Back</button>}
          </div>
        </div>
      )}

      {/* ── DECK BUILDER ── */}
      {screen==="deck"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"0 20px 80px",width:"100%",maxWidth:460}}>
          {/* Back arrow aligned with persistent ⓘ */}
          <div style={{width:"100%",paddingTop:14,paddingBottom:0,display:"flex",alignItems:"center",justifyContent:"flex-start"}}>
            <button className="btn-back-arrow" onClick={()=>setScreen("home")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A08868" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
          </div>
          {/* Heading with generous space */}
          <div style={{width:"100%",textAlign:"center",paddingTop:32,paddingBottom:32}}>
            <p style={{...GF_TITLE,fontSize:30,color:"#3C2010",lineHeight:1.3,marginBottom:10}}>Who are you playing with?</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#A08868"}}>We'll suggest the right questions</p>
          </div>
          <div style={{display:"flex",gap:10,width:"100%",marginBottom:32}}>
            {RELATIONSHIP_TYPES.map(rel=>(
              <RelTile key={rel.id} rel={rel} isActive={relationshipType===rel.id} onClick={()=>{setRelationshipType(rel.id);setActiveCats(rel.cats);setSpicyUnlocked(false);}}/>
            ))}
          </div>
          {relationshipType && currentStage?.spicyMax > 0 && (
            <div style={{marginBottom:28,display:"flex",justifyContent:"center"}}>
              <SpicyToggle enabled={spicyUnlocked} onToggle={()=>setSpicyUnlocked(v=>!v)} stageId={relationshipType}/>
            </div>
          )}
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#6B4A30",textAlign:"center",marginBottom:16,letterSpacing:"0.02em"}}>
            {relationshipType?"Fine tune your deck":"Or choose categories manually"}
          </p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:36}}>
            {CATEGORY_ORDER.map(cat=>(
              <TexturePill key={cat} cat={cat} isOn={activeCats.includes(cat)} onClick={()=>toggleCat(cat)}/>
            ))}
          </div>
          <div style={{width:"100%",background:"#FBF5EC",border:"1px solid #DDD0BC",borderRadius:16,padding:"18px 22px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"inset 0 1px 4px rgba(54,28,8,0.08), -1px 2px 8px rgba(54,28,8,0.06)"}}>
            <div>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:500,color:"#3C2010",marginBottom:4,letterSpacing:"0.02em"}}>Your deck</p>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840"}}>{unseenCount} unseen · {pool.length} total</p>
            </div>
            <div style={{display:"flex"}}>
              {activeCats.slice(0,4).map((cat,i)=><div key={cat} style={{width:26,height:34,borderRadius:4,background:CATEGORIES[cat]?.pillBg||"#8B6445",border:"2px solid #F0EAE0",marginLeft:i>0?-8:0,boxShadow:"-1px 2px 6px rgba(54,28,8,0.18)"}}/>)}
              {activeCats.length>4&&<div style={{width:26,height:34,borderRadius:4,background:"#C0A888",border:"2px solid #F0EAE0",marginLeft:-8,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"-1px 2px 6px rgba(54,28,8,0.18)"}}><span style={{fontSize:9,color:"white",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>+{activeCats.length-4}</span></div>}
            </div>
          </div>
          <TextureButton disabled={pool.length===0} onClick={()=>{if(!hasSeenTutorial){setTutStep(0);setTutorialFrom("deck");setScreen("tutorial");}else{initPlay();}}}>
            Play · {unseenCount} new questions
          </TextureButton>
        </div>
      )}

      {/* ── PLAY ── */}
      {screen==="play"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:460,height:"100vh",maxHeight:"100vh",boxSizing:"border-box",paddingLeft:12,paddingRight:12,paddingTop:"calc(env(safe-area-inset-top) + 8px)",paddingBottom:"calc(env(safe-area-inset-bottom) + 10px)"}}>
          {/* Back arrow */}
          <div style={{width:"100%",paddingBottom:6,display:"flex",alignItems:"center",justifyContent:"flex-start",flexShrink:0}}>
            <button className="btn-back-arrow" onClick={()=>setScreen("deck")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A08868" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
          </div>
          {/* Category pills — lowered 5mm, 2mm extra row gap */}
          <div style={{display:"flex",flexWrap:"wrap",gap:5,rowGap:13,justifyContent:"center",marginTop:19,width:"100%",flexShrink:0}}>
            {CATEGORY_ORDER.map(cat=>(
              <TexturePill key={cat} cat={cat} isOn={activeCats.includes(cat)} onClick={()=>toggleCat(cat)}/>
            ))}
          </div>
          {/* 50px gap pills to card */}
          <div style={{height:50,flexShrink:0}}/>
          {/* Card — fixed vh height so it never pushes stats off screen */}
          <div style={{position:"relative",width:"100%",maxWidth:340,height:"55vh",maxHeight:460,flexShrink:0,marginBottom:8}}>
            {nextCard&&!deckExhausted&&(
              <div style={{position:"absolute",inset:0,transform:"scale(0.95) translateY(10px)",transformOrigin:"bottom center",opacity:1,pointerEvents:"none",zIndex:1}}>
                <CardBack/>
              </div>
            )}
            {deckExhausted&&(
              <div style={{position:"absolute",inset:0,zIndex:2,background:"#F5EDE0",border:"1.5px solid #E8DDD0",borderRadius:20,padding:"32px 24px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",boxShadow:"-4px 12px 40px rgba(54,28,8,0.16)"}}>
                <div style={{position:"absolute",inset:10,border:"1px solid rgba(180,160,140,0.25)",borderRadius:12,pointerEvents:"none"}}/>
                <p style={{...GF_TITLE,fontSize:26,color:"#3C2010",lineHeight:1.4,marginBottom:12}}>You've asked it all.</p>
                <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#A08868",lineHeight:1.7,marginBottom:28}}>Every question in your deck has been asked. The conversations you've had are the ones worth having.</p>
                <TextureButton variant="ghost" style={{padding:"12px 32px"}} onClick={()=>setShowReset(true)}>Start fresh</TextureButton>
              </div>
            )}
            {current&&!deckExhausted&&(
              <div key={current.question} style={{position:"absolute",inset:0,zIndex:2,
                transform:gone?`translateX(${goneDir*110}vw) rotate(${goneDir*18}deg)`:`translateX(${dragX}px) rotate(${dragX*0.025}deg)`,
                transition:isDragging?"none":gone?"transform 0.28s ease-in":"transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
                cursor:flipped?"grab":"pointer",touchAction:"pan-y",
              }}
                onClick={handleCardTap}
                onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
              >
                <div style={{position:"absolute",inset:0,opacity:flipped?0:1,transform:flipped?"scale(0.94)":"scale(1)",transition:isDragging?"none":"opacity 0.22s ease, transform 0.22s ease",pointerEvents:flipped?"none":"auto"}}>
                  <CardBack/>
                </div>
                <div style={{position:"absolute",inset:0,opacity:flipped?1:0,transform:flipped?"scale(1)":"scale(0.94)",
                  transition:isDragging?"none":"opacity 0.22s ease 0.08s, transform 0.22s ease 0.08s",
                  background:cardBg,border:`1.5px solid ${cardBorder}`,borderRadius:20,padding:"24px 22px",
                  display:"flex",flexDirection:"column",justifyContent:"space-between",
                  boxShadow:"-4px 12px 40px rgba(54,28,8,0.16), -2px 4px 12px rgba(54,28,8,0.10)",pointerEvents:flipped?"auto":"none"}}>
                  <div style={{position:"absolute",inset:10,border:"1px solid rgba(180,160,140,0.25)",borderRadius:12,pointerEvents:"none"}}/>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:"#3C2410",flexShrink:0}}/>
                      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,letterSpacing:"0.18em",textTransform:"uppercase",color:"#3C2410",opacity:0.6}}>{current.category}</p>
                    </div>
                    <SpicyBadge level={current.spicy}/>
                  </div>
                  <p style={{...GF_TITLE,fontSize:displayQuestion.length>90?19:displayQuestion.length>65?22:25,lineHeight:1.55,color:"#2C1808",flex:1,display:"flex",alignItems:"center",paddingTop:10}}>
                    {displayQuestion}
                  </p>
                  {showPerspectiveToggle&&(
                    <div style={{display:"flex",justifyContent:"flex-end",paddingTop:8}}>
                      <button onClick={(e)=>{e.stopPropagation();setPerspectiveFlipped(v=>!v);}} style={{background:perspectiveFlipped?"#3C2410":"transparent",border:"1px solid #C4A882",borderRadius:100,padding:"3px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"all 0.2s"}}>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,letterSpacing:"0.08em",color:perspectiveFlipped?"#F5EDD9":"#8B6445",fontWeight:500}}>{perspectiveFlipped?"About you":"About me"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Status — always visible */}
          <div style={{flexShrink:0,textAlign:"center",marginTop:12}}>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"#A08868",letterSpacing:"0.03em",minHeight:16}}>
              {deckExhausted?"":!flipped?"Tap to reveal":Math.abs(dragX)>40?"Let go to discard":"Swipe left or right when you're done"}
            </p>
            <p style={{marginTop:4,fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#B0A090",letterSpacing:"0.03em"}}>{unseenCount} unseen · {totalPlayed} played</p>
          </div>
        </div>
      )}
    </div>
  );
}
