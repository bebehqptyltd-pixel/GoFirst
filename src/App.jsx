import { useState, useRef, useCallback, useEffect } from "react";
import { useRoom } from "./useRoom";

// ── Audio ────────────────────────────────────────────────────
// Real sound files live in public/sounds/ (served at /sounds/ by Vite).
// Uses the Web Audio API with pre-decoded buffers so playback is instant
// (no per-play decode lag). flip → card reveal, swipe → card change,
// click → button presses, tick → softer select (pills/tiles/spicy).
const MUTE_KEY = "gofirst_muted_v1";
function createAudio() {
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch {}

  let ctx = null;
  const buffers = {}; // name -> decoded AudioBuffer
  // Keep volumes low and tasteful. tick (select) is the gentlest.
  const VOL = { swipe: 0.24, flip: 0.24, click: 0.24, tick: 0.12 };

  function ensureCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" }); }
      catch { ctx = null; }
    }
    return ctx;
  }

  function load(name, src) {
    const c = ensureCtx();
    if (!c) return;
    fetch(src)
      .then(r => r.arrayBuffer())
      .then(arr => c.decodeAudioData(arr, buf => { buffers[name] = buf; }, () => {}))
      .catch(() => {});
  }
  // Decode once, up front.
  load("swipe", "/sounds/swipe.m4a");
  load("flip",  "/sounds/flip.m4a");
  load("click", "/sounds/click.m4a");

  function play(name, vol) {
    if (muted) return;
    const c = ctx;
    if (!c) return;
    // iOS starts the context suspended until a gesture; every play happens
    // inside one, so resuming here unlocks audio on first interaction.
    if (c.state === "suspended") { try { c.resume(); } catch {} }
    const buf = buffers[name];
    if (!buf) return;
    try {
      const src = c.createBufferSource();
      const g = c.createGain();
      g.gain.value = vol;
      src.buffer = buf;
      src.connect(g);
      g.connect(c.destination);
      src.start(0);
    } catch {}
  }

  return {
    resume: () => { const c = ensureCtx(); if (c && c.state === "suspended") { try { c.resume(); } catch {} } },
    flip:  () => play("flip",  VOL.flip),
    swipe: () => play("swipe", VOL.swipe),
    click: () => play("click", VOL.click),
    tick:  () => play("click", VOL.tick), // softer select sound, reuses click buffer
    isMuted: () => muted,
    setMuted: (v) => {
      muted = !!v;
      try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch {}
    },
  };
}
const audio = createAudio();


// ── Memory ───────────────────────────────────────────────────
const STORAGE_KEY = "gofirst_v2";
function loadMemory(){try{const r=localStorage.getItem(STORAGE_KEY);if(!r)return{seen:[],totalPlayed:0,activeCats:null,hasSeenTutorial:false};return JSON.parse(r);}catch{return{seen:[],totalPlayed:0,activeCats:null,hasSeenTutorial:false};}}
function saveMemory(m){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(m));}catch{}}

// ── Saved games storage ──
// Each save: { id, name, isUnnamed, stage, activeCats, spicyLevel, seen:[], totalPlayed, updatedAt }
// The single unnamed slot has id "last_game".
const SAVES_KEY = "gofirst_saves_v1";
const LAST_GAME_ID = "last_game";
function loadSaves(){
  try{
    const r=localStorage.getItem(SAVES_KEY);
    if(r) return JSON.parse(r);
  }catch{}
  // Migration: fold any existing anonymous history into a "Last game" save
  const old=loadMemory();
  if(old && (old.seen?.length || old.totalPlayed)){
    return {
      [LAST_GAME_ID]:{
        id:LAST_GAME_ID, name:"Last game", isUnnamed:true,
        stage:null, activeCats:old.activeCats||null, spicyLevel:0,
        seen:old.seen||[], totalPlayed:old.totalPlayed||0, updatedAt:Date.now(),
      }
    };
  }
  return {};
}
function persistSaves(saves){try{localStorage.setItem(SAVES_KEY,JSON.stringify(saves));}catch{}}
function makeSaveId(){return "save_"+Math.random().toString(36).slice(2,9);}


// ── Card back ────────────────────────────────────────────────
function CardBack() {
  return (
    <div style={{width:"100%",height:"100%",borderRadius:20,overflow:"hidden",boxShadow:"-4px 12px 40px rgba(54,28,8,0.22), -2px 6px 16px rgba(54,28,8,0.14), -1px 2px 4px rgba(54,28,8,0.08)"}}>
      <img src="https://i.imgur.com/RFAJysA.png" alt="" draggable="false" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
    </div>
  );
}

function FlameIcon({ size=13, color="#B84A1A" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21c3.5 0 6-2.2 6-5.5 0-2.5-1.5-4-3-5 .2 1.5-.5 3-1.8 3.8C13.5 12 13 9.5 14 7c-2.5 1-5 3.5-5 6.5 0 1 .3 2 .8 2.7C9.3 15.5 9 14.5 9.5 13.5 10 15.5 10.5 21 12 21z"/>
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
// stageMin: earliest stage this question appears in
// stageMax: latest stage this applies to (null = no upper limit, just_together = only that stage)
// spicy: 0=none, 1=warm, 2=medium, 3=hot
const ALL_QUESTIONS = [
  {question:`Describe the person on your right using only three positive words.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Use a movie title to describe your life as it currently stands.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Describe your dream weekend in under 20 words.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Do your best impression of the person to your left. Make it funny, but keep it. kind!`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share 3 words to describe your current life chapter.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you felt strongly about but have since changed your mind about?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the best advice you'd give your younger self?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is the last song you had on repeat, and what does it say about you?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is the most recent compliment you received that felt meaningful?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is the best thing that happened to you this week?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Choose one person at the table and share a favourite quality about them.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Choose one photo on your phone that captures this year so far. Explain why.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Name one thing you appreciate about your current life chapter.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you are excited about that isn't happening for a while yet?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something that you admire about the person to your left?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share a photo of a place that matters to you and why it is important.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is a win you had recently that deserves more celebration?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is a tradition you'd like to start one day?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you're grateful for that didn't seem like a positive at the time?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you've become better at this year that felt unrealistic at first?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share a memory that this game has triggered that you had forgotten about completely.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you're looking forward to that you haven't told anyone about yet.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you're quietly proud of that you don't usually mention?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What was the last thing that made you genuinely laugh out loud?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Find the oldest screenshot on your phone, that you're willing to share. Explain it.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Finish this sentence: "The thing I find most interesting about you is..."`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Give a short toast to the person on your right to honour them.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is one thing you're grateful for right now.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Go around the table, each person says what they think the others are best at.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Go around the table, everyone says one thing they appreciate about this exact moment.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Say the nicest true thing you can about the person to your right.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share a photo that instantly makes you smile.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Play or name a song that perfectly matches your current season of life.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share a story that your family will never let you live down.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share the last piece of advice that genuinely helped you.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Show the most recent photo on your camera roll and explain it.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is a place you’ve been to that you would return to tomorrow if you could?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell a story that begins with: 'I can't believe I actually did this.'`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell the funniest true story you have heard or witnessed.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share a time when luck was completely on your side.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell the person next to you one thing you genuinely appreciate about them.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell the person next to you one thing you hope for them.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell the person opposite you something you have noticed they do well.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Turn to the person next to you and tell them something you genuinely admire about them.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Describe the person opposite you as though you are reporting them to police as a missing person.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Announce your life right now as a newspaper headline.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you wish more people understood about you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you feel strongly about that you struggle to see from someone elses perspective?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What did you assume about me that turned out to be completely wrong?`,perspectiveQ:`What do you think I assumed about you that turned out to be completely wrong?`,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:true},
  {question:`What did you think I was like before you actually knew me?`,perspectiveQ:`What do you think I thought you were like before I really got to know you?`,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:true},
  {question:`What is something people assume about you based on how you look or come across at first impression?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think my biggest blind spot is?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a question you've wanted to ask me but haven't yet?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about me that made you want to get to know me better?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about me you still haven't figured out?`,perspectiveQ:`What's something about you that you think I still haven't figured out?`,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you do that people misread?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you think we have in common that might surprise me?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you want me to know about you that I might not have realised?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've noticed about me that I probably don't see in myself?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the version of you that most people don't get to see?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you hope someone thinks about when they think about you?`,perspectiveQ:`What is something you hope I think about when I think of you?`,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:true},
  {question:`What chapter of your life are you in right now?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of person do you want to have become in ten years?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What would you do differently if you weren't worried about what people thought?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you used to want that you no longer care about?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've stopped pretending to care about?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`If your life had a warning label, what would it say?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`If your child/children had to describe you to a stranger, what would they say?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What would your villain origin story be?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a skill you've pretended to have but had and just bluffed your way through - that is now an actual skill you have?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a completely unhinged rule you have for yourself?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a film or show you're embarrassed to admit you love?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a hill you'll die on for absolutely no reason?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a phrase or word you say too much?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a trend you participated in that you would undo if you could?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a word you always mispronounce and just hope nobody notices?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you owned as a kid that you'd be mortified by now?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you are absolutely terrible at but keep doing anyway?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you were convinced of as a kid that was completely wrong?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you're weirdly competitive about?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've fixed with the most ridiculous solution?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the dumbest injury you've ever had, and how did it happen?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most chaotic decision you've ever made on a whim?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most dramatic reaction you have had to something that turned out to be small?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most embarrassing thing you've ever googled?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most ridiculous thing you've ever argued about?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the pettiest thing you've ever done and felt zero guilt about?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the worst or incorrect advice you've ever confidently given someone?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the worst gift you've ever enthusiastically pretended to love?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's your most controversial food opinion?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's your most irrational fear?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's your most useless talent?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's your weirdest habit when nobody is watching?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a friendship that shaped who you are.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a moment you felt truly free.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a moment you laughed so hard you couldn't breathe.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a stranger who made a surprising impact on you.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a time everything went spectacularly wrong.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a time you felt completely out of your depth.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a time you felt deeply proud of yourself.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a time you had to start over and didn't know if you could.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a time you stood up for something and it cost you.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a time you surprised yourself.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about one of the best days of your life.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about someone who believed in you before you believed in yourself.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about the best piece of advice you ever ignored.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about the last time you were genuinely moved by something.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a decision you made that turned out way better than expected?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a memory that still makes you emotional?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a memory you wish you could relive for one hour?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a mistake you'd actually make again without hesitation?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a moment that quietly changed you?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a moment where you realised you'd changed?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a random memory you think about more than you should?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a tiny childhood memory you still remember vividly?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a version of your life that almost happened but didn't?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you did that took more courage than people realised?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the kindest thing anyone has ever said to you?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you don't think people appreciate enough while they have it?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes someone memorable?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you'll never stop being curious about?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a mystery you're happy not knowing the answer to?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes someone unforgettable?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a conversation you'll never forget?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about growing old with me that genuinely moves you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about me that's changed since we got together that you've never mentioned?`,perspectiveQ:`What's something about you that's changed that you think I've noticed but never mentioned?`,category:`Emotional Intimacy`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you hope we'll still be saying to each other in twenty years?`,perspectiveQ:`What do you think we'll still be saying to each other in twenty years?`,category:`Emotional Intimacy`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's the hardest season we've been through and what did it teach you about us?`,perspectiveQ:`What do you think the hardest season taught me about us?`,category:`Emotional Intimacy`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What does commitment actually mean to you now? How has it changed from when we first met?`,perspectiveQ:`What do you think commitment actually means to me now?`,category:`Life & Values`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a dream you had for your life that changed when we committed to each other?`,perspectiveQ:`What's a dream you think I had for my life that changed when we committed?`,category:`Life & Values`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What did we do when we were dating that you wish we still did now?`,perspectiveQ:`What did we do when we were dating that you think I wish we still did now?`,category:`Nostalgia`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`When was the moment you first thought this could be someone you spend your life with?`,perspectiveQ:`What moment do you think I first thought you could be someone I spend my life with?`,category:`Nostalgia`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a version of us from early on that you miss?`,perspectiveQ:`What's a version of us from early on that you think I miss?`,category:`Nostalgia`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about our early relationship you'd love our kids or future to know?`,perspectiveQ:`What's something about our early relationship you think I'd love our kids or future to know?`,category:`Nostalgia`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about who we were when we met that you're glad we've both grown past?`,perspectiveQ:`What's something about who I was when we met that you think I'm glad I've grown past?`,category:`Nostalgia`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something small we did in the beginning that felt like just ours?`,perspectiveQ:`What's something small from our beginning that you think I still think about?`,category:`Nostalgia`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something we used to talk about that we don't talk about anymore?`,perspectiveQ:`What's something you think I miss talking about that we don't anymore?`,category:`Nostalgia`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you used to do to impress me early on that you've since stopped?`,perspectiveQ:`What's something you think I used to do to impress you that I've since stopped?`,category:`Nostalgia`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a personality trait of mine you swore you'd never find attractive that you now love?`,perspectiveQ:`What's a personality trait of yours that you think I swore I'd never find attractive but now love?`,category:`Light & Fun`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about me that would genuinely surprise the person I was ten years ago?`,perspectiveQ:`What's something about you that you think would genuinely surprise the person I was ten years ago?`,category:`Light & Fun`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something that used to drive you crazy about me that you'd now miss if it was gone?`,perspectiveQ:`What's something about you that used to drive me crazy that you think I'd now miss?`,category:`Light & Fun`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something we swore we'd never do that we now do regularly?`,perspectiveQ:`What's something we swore we'd never do that you think I've fully embraced?`,category:`Light & Fun`,stageMin:`committed`,stageMax:null,spicy:0,canFlip:true},
  {question:`Complete the sentence: 'A good life, to me, looks like...'`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Describe a moment when you felt completely in the right place.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Describe the best day you've had in the last 12 months.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about where you are in life right now that you never would have predicted?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is one thing you wish you were better at? No judgment.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've been thinking about lately that you haven't said out loud?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does your perfect ordinary day actually look like?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you want to achieve in the next 12 months?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Everyone chooses a photo they would frame forever and explains why.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Describe your younger self in one sentence.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Name one thing you wish you could worry less about.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share a memory that still makes you smile when you think about it.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What would you like more of in your life right now?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you wish wou could make more time for?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you hope is true about your future self?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is a goal you are working towards right now?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is a superstition you know is silly but can't help but observe?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is a question you would love to ask but don't know if it’s appropriate?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you want to be remembered for?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Predict something that will happen to the person to your left in the next five years.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is an item you keep for sentimental reasons? Why is it important to you?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share a photo that represents home to you.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is the best surprise life has given you so far.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is a challenge that taught you something valuable?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is a decision you made that you'd make differently now?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share a dream you've had for your life that you have never quite let go of.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What fear have you overcome, big or small?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share a moment in the last year that quietly changed you.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell the person across from you something you've noticed about them that you've never said.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell the person beside you what your first impression of them was.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell the person opposite you one thing you've learned from them.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Who is a person who has shaped your life that nobody here has met? How did they impact your life?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What was a risk you took that was completely worth it?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Who is someone who believed in you when you needed it the most?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is one thing on your bucket list you'd love to experience in the next five years?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What three words would be happy to hear people to use to describe you?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`How do you know when you actually trust someone?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think has shaped your worldview the most?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think motivates you more than most people realise?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think people notice about you before they really know you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think people rely on you for most?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think your closest friends understand about you that others don't?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What have you achieved that you think your younger self would be proud of?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What emotion do you wish came more naturally to you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What helps you feel calm when life is overwhelming?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of people make you feel safe?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of person brings out the best in you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes somewhere feel like home to you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes you feel genuinely understood rather than just agreed with?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes you feel like yourself again when you've lost the plot a bit?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`When do you feel most like yourself?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What part of life do you think you're currently being stretched by?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What part of your life feels most like it's still being written?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What part of your life feels most meaningful right now?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What part of your personality do you think has been misunderstood most often?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What part of yourself are you still getting to know?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a belief about life that has changed for you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a boundary you've set that changed your life?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a chapter of your life you rarely talk about?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a contradiction within yourself that you've made peace with?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a fear you've learned to live alongside rather than overcome?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a part of yourself that feels difficult to explain to people?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a quality in yourself you've had to fight to keep?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a truth about yourself that took years to accept?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a version of yourself you've had to leave behind?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something that consistently restores your faith in people?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you find hard to talk about even with people you're close to?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you hope never becomes ordinary to you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you hope people remember about you when they first meet you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you need from your friendships that you find hard to ask for?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you protect fiercely in your life?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you secretly hope people notice about you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you value more now than you did ten years ago?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you wish you could tell yourself five years ago?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you're still becoming?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you're still waiting to feel ready for?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've become more gentle with yourself about?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've become unexpectedly good at?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've changed your mind about because of experience?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've discovered you're stronger than?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've inherited emotionally from your family?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've learned from disappointment?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've learned to stop apologising for?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've outgrown that you're grateful to have left behind?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've realised about yourself recently?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`When do you feel most at peace?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`When do you find it hardest to reach out to people?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think I need more of in my life?`,perspectiveQ:`What do you think you need more of in your life?`,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:true},
  {question:`What do you think I'm like when nobody is watching?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you notice about me when things get hard?`,perspectiveQ:`What do you notice you do when things get hard?`,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:true},
  {question:`What matters most you that you don't talk about enough?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about me that is obvious to you that you think other people often miss?`,perspectiveQ:`What's something about you that you think I might not have noticed?`,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about who you are now that your old friends might not recognise?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about yourself you've had to defend to people who know you well?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something most of your friends don't know about you?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you think I'm better at than I give myself credit for?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you wish you could say to someone but probably never will?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you'd want your closest friends to know about your past that you've not shared?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've noticed about yourself through your friendships?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think is the hardest part of being human?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Finish this sentence. My life would feel complete right now if...`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something beautiful you've found in something painful?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've held onto longer than you should have?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've realised too late?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most honest thing you believe about yourself?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you look for in a friendship that you rarely find?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does a really good friendship feel like to you?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does a really good ordinary life look like to you?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does freedom mean to you practically, not philosophically?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does success look like to you right now, honestly?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of future feels exciting to you?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of home environment makes you happiest?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of life are you trying to build?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What matters most to you in life now?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a quality in a friend that you think says the most about their character?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a value that runs through all of your closest friendships?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a value you hold that most people in your life don't share?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you believe about the world that most people around you don't?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you hope you never compromise on?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've let go of that made you lighter?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've outgrown that you're still a little sad about?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell me about a time you felt completely seen by someone.`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a chapter of your life you're still figuring out how to talk about?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a friendship that changed the direction of your life?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something a friend did for you that you've never forgotten?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something that broke your heart that you've never fully talked about?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've learned about yourself from a friendship ending?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the kindest thing a stranger has ever done for you?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've changed your mind about that surprised you?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think your future self is hoping you'll do next?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you wish mattered less to you?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's become more important to you with age?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a lesson life keeps trying to teach you?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think people regret most?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What are you still trying to figure out?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What feels different about your life today compared to five years ago?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What part of yourself are you still growing into?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think makes a life meaningful?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you hope never becomes normal to you?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think people are searching for underneath everything else?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think makes a person wise?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think matters at the end of a life?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of legacy actually matters?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you hope people say about you when you're not in the room?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes a year feel well spent?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does success look like when nobody is watching?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`If you could understand one thing completely, what would it be?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've experienced that still doesn't quite make sense?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think most people get wrong about happiness?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you wish more people talked about?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What fascinates you about human beings?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've observed about life that feels true?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a question you think about more often than you admit?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've realised lately that you can't stop thinking about?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've learned about connection?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the difference between being liked and being known?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes someone easy to miss?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`When do you feel closest to another person?`,perspectiveQ:null,category:`Late Night`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you find yourself thinking about after we spend time together?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What does it feel like for you in the early stages of a relationship?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What made you want to see me again after the first time we met?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's something about this that feels different to you?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's your favourite thing about early dating?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What is your least favourite thing about early dating?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`When was the last time you felt genuinely excited about someone?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What are you most nervous about right now?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's something about the way you love people that takes time to understand?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's something that would make you feel like you can completely relax around someone?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's something you've been burned by before that you're still careful about?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What do you think people get wrong from a first impressions of you?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What would you want someone to understand about you before things get more serious?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's something about yourself you hope I figure out on my own?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's something you want me to know about you that would usually take a while to come out?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What does taking it slow mean to you?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What would make you feel like this is going somewhere real?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's a red flag you look for that most people wouldn't mention?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's a green flag you look for that most people wouldn't mention?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's something you're looking for that you haven't said out loud yet?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's the best version of this? What does it look like?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`What's the thing that usually gets in the way of something becoming real for you?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:`just_together`,spicy:0,canFlip:false},
  {question:`Hold eye contact for 30 seconds without speaking.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`Recreate your first impression of me. Keep it kind and act it out.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`Tell a two sentence story about how you think you'll remember tonight.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What creates chemistry for you beyond physical attraction?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you notice about someone before you notice anything else?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does flirting look like to you when it's done well?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does genuine chemistry feel like compared to just surface attraction?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does it feel like in your body when you're really attracted to someone?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of affection makes you melt?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of conversation gives you that electric feeling?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of intimacy matters most to you?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of moments make you want to kiss someone?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of person brings out the best version of you?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of touch comes naturally to you?`,perspectiveQ:`What kind of touch do you like the most?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:true},
  {question:`What makes a long silence with someone feel comfortable rather than awkward?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes someone easy to miss when they're not around?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes you feel genuinely confident around someone?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes you feel genuinely desired rather than just wanted?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes you feel truly seen by another person?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes you want to stay up too late with someone?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a quality in someone that sneaks up on you over time?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about how someone carries themselves that draws you in?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something non-sexual you find incredibly attractive?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something someone said once that immediately made you more attracted to them?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something someone wore once that you still think about?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something subtle someone can do that drives you wild?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something that kills attraction immediately for you?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you find attractive that you've never really told anyone?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's your ideal slow Sunday together?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`When did you first realise you were attracted to me?`,perspectiveQ:`When did I first seem attracted to you?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:true},
  {question:`What kind of relationship dynamic feels healthiest to you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What version of yourself comes out in relationships?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about me you were initially unsure about?`,perspectiveQ:`What's something about you that you think I was initially unsure about?`,category:`Honest Impressions`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's your honest first impression of me, now that it's safe to say?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think about when you can't sleep?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think love asks of us that we're not always ready for?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think love should feel like?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does emotional loyalty mean to you?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does it feel like to outgrow someone you love?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does it feel like when you know something is ending before it ends?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of relationship do you never want to repeat?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of relationship would make life feel softer?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What part of yourself do you struggle to show people?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the difference between being happy and being at peace?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`When do you feel most connected to someone?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What are your non-negotiables in relationships?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you hope love feels like years from now?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think makes relationships last?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does commitment mean to you?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of partner do you want to be?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What scares you most about relationships?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What would you tell your younger self about love specifically?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`Who has shaped your idea of what love should look like?`,perspectiveQ:null,category:`Life & Values`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something people underestimate about relationships?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something that instantly makes a person more attractive?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes someone feel emotionally magnetic?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you wish more people understood about love?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a moment between two people that feels more intimate than a kiss?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of affection do you never get tired of?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something subtle that makes you feel wanted?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most attractive quality someone can have?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes anticipation exciting?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something romantic that isn't usually considered romantic?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a moment that always feels a little magical?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does chemistry feel like to you?`,perspectiveQ:null,category:`Late Night`,stageMin:`just_together`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something I do that distracts you?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`What's the first thing you noticed about me physically?`,perspectiveQ:`What do you think the first thing I noticed about you physically was?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:true},
  {question:`What's something you love and wish I would do to build anticipation?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`What's something subtle you find sexually attractive about me?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`What's something about the way I look at you that you've noticed?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`What's something I wear that you think about more than you admit?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`What kind of compliment do you actually want to hear from me?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`When did you first think about kissing me?`,perspectiveQ:`When do you think I first thought about kissing you?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:true},
  {question:`What's something about me that gets better the more you know me?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`What's a moment we've had that you've replayed in your head?`,perspectiveQ:`What's a moment we've had that you think I've replayed in my head?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:true},
  {question:`What's something about my voice or the way I laugh that you like?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`What's something I said that you're still thinking about?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`What's something about me that you find unexpectedly attractive?`,perspectiveQ:`What's something about you that you think I find unexpectedly attractive?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:true},
  {question:`What does it feel like when I walk into a room?`,perspectiveQ:`What do you think it feels like for me when you walk into a room?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:true},
  {question:`What's something you've wanted to do but haven't yet?`,perspectiveQ:`What's something you think I've wanted to do but haven't yet?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:true},
  {question:`What makes you feel genuinely flirted with?`,perspectiveQ:`What do you think makes me feel flirted with?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:true},
  {question:`What's something about being near me that you like?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`When do you think I'm most attractive?`,perspectiveQ:`When do you think you're most attractive to me?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:true},
  {question:`What's something about how we flirt that you enjoy?`,perspectiveQ:`What's something about how we flirt that you think I enjoy?`,category:`Attraction & Chemistry`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:true},
  {question:`Hold eye contact for 60 seconds without looking away. No kissing allowed until time is up.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`Tell the other person one thing about their appearance that you genuinely love. No backing out.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`Send the most flirtatious text you can think of to each other. Right now.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`Describe how you did/would introduce the other person to your friends before they meet them. What would/did you actually say?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`Move closer together, intentionally.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`just_together`,stageMax:null,spicy:1,canFlip:false},
  {question:`Share a purchase under \$100 that genuinely improved your life.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Give everyone at the table a nickname based on tonight.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Name something everyone in the group has in common that is subtle at first.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a little known fact about you that would surprise most people here?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a passion or interest that surprises people when they find out about it?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a small thing that tells you a lot about a person?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about your job or life that people would find surprising?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you do differently to most people you know?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you find genuinely fascinating that most people don't care about?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you used to be embarrassed about that you now own completely?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a book, show or film that actually changed how you think about something?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a place on your list that you haven't made it to yet?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a quality you genuinely admire in the people closest to you?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a skill you wish you had?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something small that genuinely makes your day better?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you do to reset when everything feels like too much?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you're working on right now that excites you?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've changed your mind about recently?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've learned the hard way that you'd tell anyone who would listen?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the best decision you've made in the last year?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the best piece of advice you've been given that you actually followed?`,perspectiveQ:null,category:`Life & Values`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think is underrated in life?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about adulthood that surprised you?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something that made you laugh this week?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you believed for years that turned out to be completely wrong?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you're unexpectedly good at?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most useful thing you know that most people don't?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's your most strongly held opinion about something completely unimportant?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a moment in your life that makes a great story at dinner?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a place you've been that genuinely surprised you?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a tradition from your family that you've kept or broken?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about where you grew up that shaped you?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've done recently for the first time?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the best compliment you've ever received?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most interesting conversation you've had recently?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most interesting thing you've learned in the last month?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most memorable meal you've ever had?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most spontaneous thing you've ever done?`,perspectiveQ:null,category:`Story Questions`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`Share your biggest regret or biggest non-regret, you choose.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`Find the oldest photo you have together and send it to each other.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is your favourite early memory of us?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`Retell your first date in one sentence each.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is the most meaningfuly conversation we have had that has stuck with you?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something you want to do together this year that you have not said aloud?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`Text a short love note to each other.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do I do that makes you want to be closer to me?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think keeps attraction alive in a long-term relationship?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does intimacy feel like to you when it's really working?`,perspectiveQ:`What do you think intimacy looks like for me?`,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What does it feel like for you when the chemistry between us is on?`,perspectiveQ:`What do you think it feels like for me when the chemistry between us is on?`,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What does it feel like when we're completely in sync?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What kind of moment between us gives you that electric feeling still?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes a good morning feel intimate?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes you feel most wanted by me?`,perspectiveQ:`What do you think makes me feel most wanted by you?`,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What was the moment in our relationship when you knew it was real?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a moment recently when you thought, "Yep, this is my person."?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a moment recently when you thought, I'm really lucky?`,perspectiveQ:`What's a moment recently when you think I thought, I'm really lucky?`,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a moment where you felt the most connected to me physically and emotionally at the same time?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a side of me that you find irresistible?`,perspectiveQ:`What's a side of you that you think I find irresistible?`,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a small thing I do that makes you feel genuinely seen?`,perspectiveQ:`What's a small thing you do that you think makes me feel genuinely seen?`,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a type of affection from me that means more than I probably know?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something I could do more of that would make you feel desired?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something I do that still catches you off guard in the best way?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something I wear or do that you find quietly irresistible?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about being in a relationship with me that you didn't expect to feel so good?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about how I look at you that you've noticed?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you really enjoy about how connect physically that you've never put into words?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you find physically attractive about me that you think would surprise me to hear?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about me that's become more attractive to you over time?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about my confidence or the way I carry myself that attracts you?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something I do to make you feel loved you that you want more of?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about the way I touch you that you love?`,perspectiveQ:`What's something about the way you touch me that you think I love?`,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about the way we are together that you think is genuinely sexy?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about the way we kiss or touch that you never want to lose?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something outside the bedroom that you find deeply intimate with me?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something we could do more of that makes you feel close to me?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something we did recently that reminded you why you chose me?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you find attractive about me that has nothing to do with how I look?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the difference between wanting me and choosing me? What does each feel like?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something I do in an argument that disarms you instantly`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What is something that I do in an argument that you would like to stop but you have never told me?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most attractive thing someone can do in an argument?`,perspectiveQ:null,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`When do you find me most attractive, and does it surprise you?`,perspectiveQ:`When do you think I find you most attractive?`,category:`Attraction & Chemistry`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What are you still healing from?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you do when you need to process something hard?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you need most when you're stressed?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think I need more of from you right now?`,perspectiveQ:`What do you need more of from me right now?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What do you think is the biggest thing we've had to overcome together?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you think is the secret to why we work?`,perspectiveQ:`What do you think I'd say is the secret to why we work?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What do you think is the thing that holds us together when everything else gets hard?`,perspectiveQ:`What do you think I'd say holds us together when everything else gets hard?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What do you think makes us work?`,perspectiveQ:`What do you think I'd say makes us work?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What do you wish you did more of for me, but don't always deliver?`,perspectiveQ:`What do you wish I would do more of?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What do you think we've made easier for each other?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What do you wish you were better at emotionally?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does it feel like to trust someone completely?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does it feel like when we're really in sync?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does it feel like when you've pushed someone away without meaning to?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does it look like when you're at your worst, and what do you need then?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does loneliness feel like for you specifically?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes you feel deeply loved?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What makes you shut down emotionally?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What part of you do you find it hardest to share?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
  {question:`What part of yourself do you find easiest to share with me?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a fear you have about us that you've never said out loud?`,perspectiveQ:`What's a fear you think I have about us that I've never said out loud?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a moment you felt like we really showed up for each other?`,perspectiveQ:`What is a moment where you felt I really showed up for you`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a moment you felt most proud of us as a couple?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a role you play in my life that goes beyond being my partner?`,perspectiveQ:`What's a role you think I play in your life that goes beyond being your partner?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a version of yourself that only I get to see?`,perspectiveQ:`What's a version of me that you think only you get to see?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's one thing you'd want to say to me if you knew I'd really hear it?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something I do that makes you feel most loved that I probably don't realise?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about being loved that you're still learning?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about how we argue that you think is actually healthy?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about our life together that you didn't expect to love?`,perspectiveQ:`What's something about our life together that you think I didn't expect to love?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about our relationship that has surprised you?`,perspectiveQ:`What do you think has surprised me most about our relationship?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about the life we've built together that you're most proud of?`,perspectiveQ:`What's something about the life we've built together that you think I'm most proud of?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you truly appreciate about the way I love you that you've never told me?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about the way we communicate that you want to get better at?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about us that feels different from other relationships you've known?`,perspectiveQ:`What do you think feels different about us from other relationships I've known?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about where we are right now that feels right?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something that's shifted between us recently that you've noticed? Good or bad.`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you carry alone that you wish you didn't have to?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you do to take care of our relationship that you don't think I notice?`,perspectiveQ:`What's something you think I do to take care of our relationship that I don't even notice?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you feel safer doing because we're together?`,perspectiveQ:`What do you think I feel safer doing because we're together?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you hope we never stop talking about?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you need from me that you've struggled to ask for?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you want to protect about what we have?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've come to appreciate about me more over time?`,perspectiveQ:`What would you like to think I have come to appreciate about you over time?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you've forgiven me for that you've never actually said out loud?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've forgiven someone for that took a long time?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've had to unlearn about how to love people?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've learned about love from being with me?`,perspectiveQ:`What's something you think I've learned about love from being with you?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you've learned about yourself through loving me?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've wanted to say but never found the right moment for?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've never said to a partner before that you want to say to me?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you've sacrificed for this relationship that you've never mentioned?`,perspectiveQ:`What's something you've noticed I have sacrificed for this relationship?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's the hardest emotion for you to let someone else see?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most honest thing you could say about where we are right now as a couple?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most important thing we've taught each other?`,perspectiveQ:`What is the most important thing you have learned from me?`,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`When do you feel most emotionally safe?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about being with me that surprised you?`,perspectiveQ:`What's something about being with you that you think surprised me?`,category:`Honest Impressions`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about being with you that I probably don't fully understand yet?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about me that you've grown to appreciate more over time?`,perspectiveQ:null,category:`Honest Impressions`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about us that you didn't expect?`,perspectiveQ:`What's something about us that you think I didn't expect?`,category:`Honest Impressions`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you've started doing differently because of me?`,perspectiveQ:`What's something you notice I've started doing differently because of you?`,category:`Honest Impressions`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What would a completely honest version of you say right now?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What does a really good week with me look like?`,perspectiveQ:null,category:`Life & Values`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a version of our future that you think about but haven't mentioned?`,perspectiveQ:null,category:`Life & Values`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about our future that excites you that we haven't talked about yet?`,perspectiveQ:null,category:`Life & Values`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something about your life that's better since we've been together?`,perspectiveQ:null,category:`Life & Values`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you want to do together that we haven't done yet?`,perspectiveQ:null,category:`Life & Values`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you want us to be more intentional about in our relationship?`,perspectiveQ:null,category:`Life & Values`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you want us to do differently in the next chapter?`,perspectiveQ:`What's something you think I want us to do differently in the next chapter?`,category:`Life & Values`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something you want us to prioritise more in the next year?`,perspectiveQ:`What's something you think I want us to prioritise more in the next year?`,category:`Life & Values`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What song or film takes you straight back to when we first got together?`,perspectiveQ:`What song or film do you think takes me straight back to when we first got together?`,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a compliment I gave you early in our relationship that you still think about?`,perspectiveQ:null,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a meal or restaurant that will always remind you of us?`,perspectiveQ:null,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a memory of us that you never want to forget?`,perspectiveQ:null,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What a photo of us that captures exactly who we were at that moment?`,perspectiveQ:null,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a place that means something special to you about our relationship that we should go back to?`,perspectiveQ:null,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a version of a date we used to go on that you'd love to recreate?`,perspectiveQ:`What's a date from our past that you think I'd love to recreate?`,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something special or interesting about falling for me that I probably don't know?`,perspectiveQ:null,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something you were nervous about telling me early on that now seems completely fine?`,perspectiveQ:null,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the first trip we took together and what do you remember most about it?`,perspectiveQ:null,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the moment you first felt truly comfortable being yourself with me?`,perspectiveQ:`What moment do you think I first felt truly comfortable being myself with you?`,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's the moment you knew this was going to be something real?`,perspectiveQ:`What do you think was the moment I knew this was going to be something real?`,category:`Nostalgia`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`If our relationship was a TV show, what genre would it be?`,perspectiveQ:`What genre do you think I'd say our relationship TV show would be?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`If someone had to play me in the movie of our relationship, who would you cast and why?`,perspectiveQ:`If someone had to play you in the movie of our relationship, who do you think I'd cast?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`If someone were writing a book about our relationship, what would the funniest chapter be?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`Send a text with three emojis that describe our relationship.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a habit of mine you've picked up?`,perspectiveQ:`What's a habit of yours that you think noticed I've picked up?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a phrase I say so often you could have it printed on a mug?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a phrase or word that belongs entirely to us?`,perspectiveQ:`What's a phrase or word that belongs to us that you think I use more than you?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's a running joke we have that would make absolutely no sense to anyone else?`,perspectiveQ:`What running joke of ours do you think I find funnier than you do?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's my most annoying habit that you've just completely accepted as part of the deal?`,perspectiveQ:`What do you think is your most annoying habit that I've just completely accepted?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's my most dramatic reaction to something completely trivial?`,perspectiveQ:`What's your most dramatic reaction to something completely trivial that you think I secretly find adorable?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's my most dramatic trait and how have you learned to work with it?`,perspectiveQ:`What's your most dramatic trait and how do you think I've learned to work with it?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's our most legendary inside joke and where did it come from?`,perspectiveQ:`What do you think is my favourite inside joke of ours?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something I bought that you thought was completely ridiculous but secretly used anyway?`,perspectiveQ:`What's something you bought that I thought was completely ridiculous but secretly used anyway?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something I do that you'd find really strange if a stranger did it?`,perspectiveQ:`What's something you do that I'd find really strange if a stranger did it?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about living with me that nobody else would understand?`,perspectiveQ:`What's something about living with you that I'd say nobody else would understand?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something about our home that guests notice but we've completely stopped seeing?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something we disagree on that we've just agreed to permanently disagree on?`,perspectiveQ:`What thing we permanently disagree on do you think bothers me more than I let on?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's something we do together that would look completely bizarre to an outsider?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the funniest thing one of us has said in our sleep?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the most chaotic trip or experience we've had together?`,perspectiveQ:`What chaotic experience of ours do you think I tell the best version of?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's the most elaborate thing either of us has ever done to avoid a difficult conversation?`,perspectiveQ:`What do you think is the most elaborate thing I've done to avoid a difficult conversation?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's the most memorable thing I've ever done to win an argument even when I was wrong?`,perspectiveQ:`What's the most memorable thing you've done to win an argument even when you were wrong?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's the most ridiculous argument we've ever had?`,perspectiveQ:`What's the most ridiculous argument we've ever had that you think I still think about?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What's the thing I do that makes you roll your eyes but secretly makes you love me more?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's the weirdest thing that's become a tradition for us?`,perspectiveQ:`What's the weirdest tradition of ours that you think I secretly love?`,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:true},
  {question:`What is the worst gift I've ever given you that you pretended to love?`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's a memory that still gives you butterflies?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:0,canFlip:false},
  {question:`What's something I do that instantly turns up the heat between us?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What is a way I touch you (that is not sexual) that instantly turns you on?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What do you love most about kissing me? If you can't describe it, show it.`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's a memorable moment between us that felt unexpectedly intimate?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's something about physical closeness with me that you love?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What does it feel like for you when we slow down together?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's something about the way I touch you that you never want to stop?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What does intimacy feel like to you when it's completely unhurried?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's something I do without thinking that you find deeply attractive?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's a moment when you felt completely present with me?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's something about the way we are together physically that feels completely ours?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What part of my body do you love that I probably don't think about?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's something about being physically close to me that calms you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What does it feel like for you the moment before we kiss?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's something you've never said out loud about what you love about us physically?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What makes you feel close to me in a way that has nothing to do with touch?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's something about the way we connect that you think is rare?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's a simple thing I do that makes you feel like everything is okay?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What does it feel like when we're completely in sync with each other physically and emotionally?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`Without speaking, show the other person somewhere on your body that holds tension. Let them decide what to do with that information.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`Sit closer than you normally would. Don't move for five minutes.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`Tell the other person one thing about how they physically make you feel that you've never said out loud.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`Put on a song that makes you think of them. Don't explain. Just play it.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`Take their hand. Hold it. Tell them one thing you notice.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:2,canFlip:false},
  {question:`What's something you've thought about doing with me that you haven't said out loud yet?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's a fantasy you have that involves me?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's something you want more of from me that you've been waiting to ask for?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's a version of us together that you want to explore?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What do I do that makes you feel the most wanted?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's something about desire that you wish I understood better?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What would your perfect night with me look like from start to finish? Be honest.`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's something you love about our physical relationship that you never say out loud?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's something you want to try that you haven't brought up yet?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What makes you feel completely uninhibited with me?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's a memory of us that turns you on every time you think of it?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What do you think about when you want to feel close to me?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's something about intimacy with me that you could never get tired of?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What would you do if you had no inhibitions tonight?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's something you'd love me to initiate more?`,perspectiveQ:`What's something you think I'd love you to initiate more?`,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:true},
  {question:`What's something about desire that changes the longer you're with someone?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's something you want me to know about what you need?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What's a version of tonight you'd love to create?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What makes you feel completely yourself with me, including physically?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What do you wish happened more between us?`,perspectiveQ:null,category:`Late Night`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`Write down one thing you want to do together tonight that you haven't said out loud. Swap and read.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`Tell the other person exactly what you find irresistible about them right now. No editing.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`Look each other directly in the eyes for 30 seconds. Then one of you decides what happens next.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`Describe a memory of me that you still think about. Be specific.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`Tell me something you've been holding back on saying. Tonight is the night.`,perspectiveQ:null,category:`Light & Fun`,stageMin:`were_a_thing`,stageMax:null,spicy:3,canFlip:false},
  {question:`What makes someone feel like home to you?`,perspectiveQ:null,category:`Emotional Intimacy`,stageMin:`friends`,stageMax:null,spicy:0,canFlip:false},
];

const CATEGORY_ORDER = ["Light & Fun","Story Questions","Attraction & Chemistry","Honest Impressions","Life & Values","Nostalgia","Emotional Intimacy","Late Night"];

const CATEGORIES = {
  "Light & Fun":            {pillBg:"#D4C4B0",pillText:"#3C2410",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Story Questions":        {pillBg:"#C4A882",pillText:"#3C2410",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Attraction & Chemistry": {pillBg:"#B8956A",pillText:"#3C2410",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Honest Impressions":     {pillBg:"#A67D55",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Life & Values":          {pillBg:"#8B6445",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Nostalgia":              {pillBg:"#7A5535",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Emotional Intimacy":     {pillBg:"#6B4A30",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
  "Late Night":             {pillBg:"#3C2410",pillText:"#F5EDD9",cardBg:"#F5EDE0",cardBorder:"#E8DDD0"},
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
  {id:"friends",       label:"Friends & groups",      description:"",          cats:["Light & Fun","Story Questions","Honest Impressions","Life & Values"],                    spicyMax:0},
  {id:"just_together", label:"Learning each other",    description:"< 6 mo",     cats:["Light & Fun","Attraction & Chemistry","Honest Impressions","Story Questions","Life & Values"],           spicyMax:1},
  {id:"were_a_thing",  label:"Building on history",    description:"6-24 mo",    cats:["Attraction & Chemistry","Emotional Intimacy","Life & Values","Nostalgia","Honest Impressions"],           spicyMax:2},
  {id:"committed",     label:"Long-term connection",   description:"2 yr+",      cats:["Emotional Intimacy","Life & Values","Late Night","Nostalgia","Honest Impressions","Attraction & Chemistry"], spicyMax:3},
];

const TUTORIAL_STEPS = [
  {title:"Welcome to Go First",    body:"A card game for people brave enough to say the things typically left unsaid. There are no wrong answers.",                                                                                                          dare:null},
  {title:"Tap to flip",            body:"Each card starts face down. Tap it to reveal the question. Take turns answering — or answer together.",                                                                                                           dare:null},
  {title:"Swipe to move on",       body:"Done with a question? Swipe left or right to move to the next card. You can skip anything that doesn't feel right.",                                                                                              dare:null},
  {title:"Flip the perspective",   body:"Some cards can be flipped. Tap the toggle on the card face to hear the same question from another perspective.",                                                                                     dare:null},
  {title:"Play it your way",       body:"Choose your relationship stage before you play. Fine-tune your categories, and turn up the heat when you're ready. Spicy questions unlock as you go deeper. Use the ⓘ at any time to revisit these instructions.", dare:"Who will Go First?"},
];

function flipQuestion(q){
  if(!q)return q;
  return q.replace(/\bdo you find\b/gi,"do I find").replace(/\bdo you\b/gi,"do I").replace(/\byou find\b/gi,"I find").replace(/\byou feel\b/gi,"I feel").replace(/\byou need\b/gi,"I need").replace(/\byou want\b/gi,"I want").replace(/\byou think\b/gi,"I think").replace(/\byou wish\b/gi,"I wish").replace(/\byou love\b/gi,"I love").replace(/\byour\b/gi,"my").replace(/\bYour\b/g,"My").replace(/\byou\b/gi,"I").replace(/\bYou\b/g,"I").replace(/\bI I\b/g,"I").trim();
}

const STAGE_ORDER = ['friends','just_together','were_a_thing','committed'];

// Connexion Studio cross-promo. Set this URL once the coming-soon site is live;
// until then the button renders but intentionally does nothing.
const CONNEXION_URL = null;
function openConnexion(){ if(CONNEXION_URL){ try{ window.open(CONNEXION_URL,"_blank","noopener"); }catch{} } }

function buildPool(activeCats, stageId, spicyLevel) {
  return ALL_QUESTIONS.filter(q => {
    if (!activeCats.includes(q.category)) return false;
    if (!stageId || stageId === null) return q.spicy === 0;
    const stageIdx = STAGE_ORDER.indexOf(stageId);
    const minIdx = STAGE_ORDER.indexOf(q.stageMin);
    const maxIdx = q.stageMax ? STAGE_ORDER.indexOf(q.stageMax) : 3;
    if (stageIdx < minIdx || stageIdx > maxIdx) return false;
    // Committed: only show questions that start at were_a_thing or committed
    if (stageId === 'committed' && minIdx < STAGE_ORDER.indexOf('were_a_thing')) return false;
    if (q.spicy > 0 && q.spicy > spicyLevel) return false;
    return true;
  });
}

function pickNextUnseen(pool,seenSet,excludeQ){
  const unseen=pool.filter(q=>!seenSet.has(q.question)&&q.question!==excludeQ);
  if(unseen.length>0)return unseen[Math.floor(Math.random()*unseen.length)];
  return null; // nothing left unseen -- signals the deck is exhausted
}

function findQ(text){ for(const q of ALL_QUESTIONS){ if(q.question===text) return q; } return null; }

// Solo next-card picker that understands parking.
// Priority: (1) stageQueue -- cards saved "for next stage", injected at the
// front of the new stage; (2) fresh unseen cards (excluding both park sets);
// (3) park-for-later cards, served once the fresh deck is spent. Returns the
// chosen card plus the (possibly shortened) stageQueue.
function pickSolo(pool, seenSet, laterSet, stageSet, queueArr, excludeQ){
  const q = queueArr ? [...queueArr] : [];
  while(q.length){
    const t = q[0];
    if(!seenSet.has(t) && t!==excludeQ){
      const obj = findQ(t);
      if(obj) return {pick:obj, queue:q.slice(1)};
    }
    q.shift(); // drop stale/seen entries
  }
  const fresh = pool.filter(x=>!seenSet.has(x.question)&&!laterSet.has(x.question)&&!stageSet.has(x.question)&&x.question!==excludeQ);
  if(fresh.length) return {pick:fresh[Math.floor(Math.random()*fresh.length)], queue:q};
  const later=[];
  laterSet.forEach(t=>{ if(t!==excludeQ && pool.some(x=>x.question===t)) later.push(t); });
  if(later.length) return {pick:findQ(later[0]), queue:q};
  return {pick:null, queue:q};
}

function TexturePill({cat, isOn, onClick, size="normal", disabled=false}) {
  const d = CATEGORIES[cat];
  if (!d) return null;
  const small = size === "small";
  const handleClick = onClick ? ()=>{ if(!disabled) audio.tick(); onClick(); } : undefined;
  return (
    <button onClick={handleClick} style={{
      position:"relative", overflow:"hidden",
      border: `1.5px solid ${isOn ? "transparent" : disabled ? "#E8E0D5" : d.pillBg}`,
      borderRadius:100,
      padding: "4px 10px",
      cursor: disabled ? "default" : "pointer", display:"inline-flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'DM Sans',sans-serif", fontSize: 11,
      fontWeight:500, letterSpacing:"0.04em", whiteSpace:"nowrap",
      color: disabled ? "#C8BEB2" : isOn ? d.pillText : "#5C4030",
      background: disabled ? "transparent" : isOn ? d.pillBg : "transparent",
      opacity: disabled ? 0.5 : isOn ? 1 : 0.9, transition:"background 0.2s, color 0.2s",
      boxShadow: isOn && !disabled ? `-1px 3px 8px rgba(54,28,8,0.18), inset 0 1px 0 rgba(255,255,255,0.2)` : "none",
    }}>
      {isOn && !disabled && (
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
  const handleClick = onClick ? (e)=>{audio.click();onClick(e);} : undefined;
  return (
    <button onClick={handleClick} disabled={disabled} className="texture-btn" style={{
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
  const handleClick = onClick ? ()=>{ audio.tick(); onClick(); } : undefined;
  return (
    <button onClick={handleClick} style={{
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
      {rel.description && (
        <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:isActive?"#D4B882":"#A0805C",position:"relative",fontWeight:500,textAlign:"center",letterSpacing:"0.04em"}}>{rel.description}</p>
      )}
    </button>
  );
}

function SpicyToggle({ level, onCycle, stageId }) {
  const stage = RELATIONSHIP_TYPES.find(r=>r.id===stageId);
  if (!stage || stage.spicyMax === 0) return null;
  const LABELS = {0:"Turn up the heat", 1:"Mild", 2:"Medium", 3:"Hot"};
  const isOn = level > 0;
  const flameColor = isOn ? "#FFFFFF" : "#8B6445";
  const handleCycle = onCycle ? ()=>{ audio.tick(); onCycle(); } : undefined;
  return (
    <button onClick={handleCycle} style={{
      display:"flex", alignItems:"center", gap:8,
      background: isOn ? "#3C2010" : "transparent",
      border:`1.5px solid ${isOn?"#3C2010":"#C4A882"}`,
      borderRadius:100, padding:"8px 18px", cursor:"pointer", transition:"all 0.2s",
      boxShadow: isOn ? `-1px 3px 8px rgba(54,28,8,0.20)` : "none",
    }}>
      <div style={{display:"flex",gap:2}}>
        {Array.from({length: Math.max(level,1)}).map((_,i)=>(
          <FlameIcon key={i} size={13} color={i < level ? flameColor : "#C4A882"}/>
        ))}
      </div>
      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:500,letterSpacing:"0.06em",color:isOn?"#F5EDD9":"#7A5840"}}>
        {LABELS[level]}
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
  const [spicyLevel, setSpicyLevel] = useState(0);
  const [perspectiveFlipped, setPerspectiveFlipped] = useState(false);
  const [seenQuestions, setSeenQuestions] = useState(new Set(mem.seen||[]));
  const [totalPlayed, setTotalPlayed] = useState(mem.totalPlayed||0);
  // Parking: park-for-later returns at the end of the deck; park-for-stage is
  // held out of the current stage and injected at the front of the next one.
  const [parkedLater, setParkedLater] = useState(new Set(mem.parkedLater||[]));
  const [parkedForStage, setParkedForStage] = useState(new Set(mem.parkedForStage||[]));
  const [stageQueue, setStageQueue] = useState(Array.isArray(mem.stageQueue)?mem.stageQueue:[]);
  const [showPark, setShowPark] = useState(false);
  // Dev-only testing shortcut: add ?dev=1 to the URL to reveal a button that
  // jumps straight to the exhaustion screen for the current stage.
  const DEV = typeof window!=="undefined" && new URLSearchParams(window.location.search).get("dev")==="1";
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
  const [muted, setMuted] = useState(() => audio.isMuted());
  const dragStartX = useRef(null);
  const hasDragged = useRef(false);

  // Reset all local play state when entering a new room or game
  const resetPlayState = useCallback(() => {
    setFlipped(false);
    setDragX(0);
    setGone(false);
    setGoneDir(1);
    setIsDragging(false);
    setPerspectiveFlipped(false);
    setDeckExhausted(false);
    hasDragged.current = false;
    dragStartX.current = null;
  }, []);
  const { roomCode, roomState, isHost, status: roomStatus, error: roomError, createRoom, joinRoom, syncAction, leaveRoom } = useRoom();

  // Reset hasDragged when the room's current question changes
  // This catches updates from the other player so taps work on new cards
  useEffect(()=>{
    if(roomState?.currentQuestion){
      hasDragged.current = false;
      setDragX(0);
      setIsDragging(false);
    }
  },[roomState?.currentQuestion?.question]);

  // Both players apply the room's deck configuration so category and
  // spicy toggles stay in sync no matter who changes them
  useEffect(()=>{
    if(roomState && roomCode){
      if(roomState.stage) setRelationshipType(roomState.stage);
      if(Array.isArray(roomState.activeCats)) setActiveCats(roomState.activeCats);
      if(typeof roomState.spicyLevel==="number") setSpicyLevel(roomState.spicyLevel);
    }
  },[roomState?.stage, JSON.stringify(roomState?.activeCats), roomState?.spicyLevel, roomCode]);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [togetherMode, setTogetherMode] = useState(false);
  const [togetherSeedSeen, setTogetherSeedSeen] = useState([]); // seen list to seed a room when continuing a save together
  const [showChangeRel, setShowChangeRel] = useState(false);    // change-relationship picker
  const [partnerName, setPartnerName] = useState("");

  // ── Saved games ──
  const [saves, setSaves] = useState(()=>loadSaves());
  const [activeSaveId, setActiveSaveId] = useState(LAST_GAME_ID);
  const [showSavedGames, setShowSavedGames] = useState(false);
  const [deleteSaveTarget, setDeleteSaveTarget] = useState(null); // {id, name} pending deletion
  const [namePromptOpen, setNamePromptOpen] = useState(false);   // naming dialog
  const [namingSaveId, setNamingSaveId] = useState(LAST_GAME_ID); // which save is being named
  const [nameInput, setNameInput] = useState("");
  const [overwritePromptOpen, setOverwritePromptOpen] = useState(false); // unnamed-overwrite warning
  // Persist saves whenever they change
  useEffect(()=>{persistSaves(saves);},[saves]);
  // Does an unnamed "Last game" with real progress exist?
  const lastGameHasProgress = !!(saves[LAST_GAME_ID]?.seen?.length);
  // Are there any saves worth showing in the list?
  const hasAnySaves = Object.values(saves).some(s=>s && (s.seen?.length || s.totalPlayed));

  useEffect(()=>{saveMemory({seen:[...seenQuestions],totalPlayed,activeCats,hasSeenTutorial,parkedLater:[...parkedLater],parkedForStage:[...parkedForStage],stageQueue});},[seenQuestions,totalPlayed,activeCats,hasSeenTutorial,parkedLater,parkedForStage,stageQueue]);

  // Auto-save live progress to the active save slot during solo play.
  // (Connected play tracks progress in the room, not local saves.)
  useEffect(()=>{
    if(screen!=="play") return;
    setSaves(prev=>{
      const existing = prev[activeSaveId] || {id:activeSaveId, name:activeSaveId===LAST_GAME_ID?"Last game":"", isUnnamed:activeSaveId===LAST_GAME_ID};
      return {
        ...prev,
        [activeSaveId]:{
          ...existing,
          id:activeSaveId,
          stage:relationshipType,
          activeCats,
          spicyLevel,
          seen:[...seenQuestions],
          totalPlayed,
          parkedLater:[...parkedLater],
          parkedForStage:[...parkedForStage],
          stageQueue,
          updatedAt:Date.now(),
        }
      };
    });
  },[seenQuestions,totalPlayed,screen,activeSaveId,relationshipType,activeCats,spicyLevel,parkedLater,parkedForStage,stageQueue]);

  // Restore a saved game into live play
  const restoreSave = useCallback((id)=>{
    const s = saves[id];
    if(!s) return;
    setActiveSaveId(id);
    setSeenQuestions(new Set(s.seen||[]));
    setTotalPlayed(s.totalPlayed||0);
    setParkedLater(new Set(s.parkedLater||[]));
    setParkedForStage(new Set(s.parkedForStage||[]));
    setStageQueue(Array.isArray(s.stageQueue)?s.stageQueue:[]);
    if(s.stage) setRelationshipType(s.stage);
    if(Array.isArray(s.activeCats)&&s.activeCats.length) setActiveCats(s.activeCats);
    setSpicyLevel(typeof s.spicyLevel==="number"?s.spicyLevel:0);
    setShowSavedGames(false);
    // In Play Together: continue this game into a room. Load its config and
    // history, seed the room from its seen list, and stay in the deck builder
    // so the user can create a room rather than dropping into solo play.
    if(togetherMode){
      setTogetherSeedSeen(s.seen||[]);
      setScreen("deck");
      return;
    }
    // Solo: build the pool from the restored config and start playing
    const cats = (Array.isArray(s.activeCats)&&s.activeCats.length)?s.activeCats:activeCats;
    const p = buildPool(cats, s.stage||relationshipType, typeof s.spicyLevel==="number"?s.spicyLevel:0);
    const seenSet = new Set(s.seen||[]);
    const first = pickNextUnseen(p, seenSet, "");
    const second = pickNextUnseen(p, seenSet, first?.question||"");
    setCurrent(first); setNextCard(second);
    resetPlayState(); setCount(1); setDeckExhausted(!first); setScreen("play");
    // First time restoring an unnamed game (Last game or a Play Together
    // save) -- offer to name it
    if(id===LAST_GAME_ID || s.isUnnamed){
      setNamingSaveId(id);
      setNameInput("");
      setNamePromptOpen(true);
    }
  },[saves,activeCats,relationshipType,resetPlayState,togetherMode]);

  // Delete a saved game
  const deleteSave = useCallback((id)=>{
    setSaves(prev=>{
      const next={...prev};
      delete next[id];
      return next;
    });
    // If we deleted the active save, fall back to a fresh Last game
    setActiveSaveId(prev=>prev===id?LAST_GAME_ID:prev);
    setDeleteSaveTarget(null);
  },[]);

  // Name a save. For the unnamed Last game this graduates it to a new
  // permanent id (freeing the Last game slot). For any other unnamed save
  // (e.g. a Play Together save) it renames in place. Returns the save id.
  const nameSave = useCallback((rawName, targetId)=>{
    const name = (rawName||"").trim();
    if(!name) return null;
    const tid = targetId||LAST_GAME_ID;
    if(tid===LAST_GAME_ID){
      const newId = makeSaveId();
      setSaves(prev=>{
        const lg = prev[LAST_GAME_ID];
        if(!lg) return prev;
        const named = {...lg, id:newId, name, isUnnamed:false, updatedAt:Date.now()};
        const next = {...prev, [newId]:named};
        delete next[LAST_GAME_ID];
        return next;
      });
      return newId;
    }
    setSaves(prev=>{
      const s = prev[tid];
      if(!s) return prev;
      return {...prev, [tid]:{...s, name, isUnnamed:false, updatedAt:Date.now()}};
    });
    return tid;
  },[]);

  // Valid categories for a given stage
  const catsForStage = useCallback((stageId)=>{
    return CATEGORY_ORDER.filter(cat=>ALL_QUESTIONS.some(q=>{
      const si=STAGE_ORDER.indexOf(stageId);
      const mi=STAGE_ORDER.indexOf(q.stageMin);
      const mx=q.stageMax?STAGE_ORDER.indexOf(q.stageMax):3;
      return q.category===cat && si>=mi && si<=mx;
    }));
  },[]);

  // How many unseen questions a stage would offer right now. Counts at the
  // spicy level that will actually apply after switching (current level,
  // clamped to the stage's max) so the number matches the deck you land in.
  const newCountForStage = useCallback((stageId)=>{
    const cats = catsForStage(stageId);
    const stageMax = RELATIONSHIP_TYPES.find(r=>r.id===stageId)?.spicyMax||0;
    const connected = screen==="connected-play" && roomState;
    const curSpicy = connected ? (roomState.spicyLevel||0) : spicyLevel;
    const applied = Math.min(curSpicy, stageMax);
    const p = buildPool(cats, stageId, applied);
    const seen = connected ? new Set(roomState.seenQuestions||[]) : seenQuestions;
    return p.filter(q=>!seen.has(q.question)).length;
  },[catsForStage,seenQuestions,screen,roomState,spicyLevel]);

  // Switch relationship stage mid-game, preserving seen history so crossover
  // questions are skipped and only genuinely new ones appear.
  const changeRelationship = useCallback((stageId)=>{
    const cats = catsForStage(stageId);
    const stageMax = RELATIONSHIP_TYPES.find(r=>r.id===stageId)?.spicyMax||0;
    // Connected Play Together: push the change through the room so BOTH
    // players' decks update. The room-config effect applies stage/cats/spicy
    // on each device, and the new current/next come from the shared seen list.
    if(screen==="connected-play" && roomCode && roomState){
      const newSpicy = Math.min(roomState.spicyLevel||0, stageMax);
      const p = buildPool(cats, stageId, newSpicy);
      const seenSet = new Set(roomState.seenQuestions||[]);
      const first = pickNextUnseen(p, seenSet, "");
      const second = pickNextUnseen(p, seenSet, first?.question||"");
      syncAction({
        stage:stageId,
        activeCats:cats,
        spicyLevel:newSpicy,
        currentQuestion:first||null,
        nextQuestion:second||null,
        flipped:false,
        perspectiveFlipped:false,
      });
      setShowChangeRel(false); setShowInfo(false);
      return;
    }
    // Solo
    const newSpicy = Math.min(spicyLevel, stageMax);
    setRelationshipType(stageId);
    setActiveCats(cats);
    setSpicyLevel(newSpicy);
    const p = buildPool(cats, stageId, newSpicy);
    // Cards saved "for next stage" surface now, at the front of the new deck.
    const injected = [...parkedForStage, ...stageQueue];
    const clearedStage = new Set();
    setParkedForStage(clearedStage);
    const r1 = pickSolo(p, seenQuestions, parkedLater, clearedStage, injected, "");
    const r2 = pickSolo(p, seenQuestions, parkedLater, clearedStage, r1.queue, r1.pick?.question||"");
    setStageQueue(r2.queue);
    setCurrent(r1.pick); setNextCard(r2.pick);
    setFlipped(false); setDragX(0); setGone(false); setIsDragging(false);
    hasDragged.current=false; setPerspectiveFlipped(false);
    setDeckExhausted(!r1.pick);
    setCount(c=>c+1);
    setShowChangeRel(false); setShowInfo(false);
  },[catsForStage,spicyLevel,seenQuestions,screen,roomCode,roomState,syncAction,parkedLater,parkedForStage,stageQueue]);

  // Replay the current deck from scratch (clears seen for this configuration)
  const replayCurrent = useCallback(()=>{
    setSeenQuestions(new Set());
    setTotalPlayed(0);
    setParkedLater(new Set()); setParkedForStage(new Set()); setStageQueue([]);
    const p = buildPool(activeCats, relationshipType, spicyLevel);
    const empty = new Set();
    const first = pickNextUnseen(p, empty, "");
    const second = pickNextUnseen(p, empty, first?.question||"");
    setCurrent(first); setNextCard(second);
    setFlipped(false); setDragX(0); setGone(false); setIsDragging(false);
    hasDragged.current=false; setPerspectiveFlipped(false);
    setDeckExhausted(false); setCount(1);
  },[activeCats,relationshipType,spicyLevel]);

  // union-merging with any existing save for the same partner so
  // alternating-host sessions never lose history. Runs on both devices.
  const saveTogetherProgress = useCallback(()=>{
    if(!roomState) return;
    const partnerId = isHost ? roomState.guestId : roomState.hostId;
    const roomSeen = roomState.seenQuestions || [];
    if(!roomSeen.length) return; // nothing played, nothing to save
    setSaves(prev=>{
      const existing = Object.values(prev).find(s=>s && s.partnerId===partnerId && partnerId);
      const mergedSeen = Array.from(new Set([...(existing?.seen||[]), ...roomSeen]));
      const id = existing?.id || makeSaveId();
      const dateLabel = new Date().toLocaleDateString(undefined,{day:"numeric",month:"short"});
      return {
        ...prev,
        [id]:{
          id,
          name: existing?.name || `Play Together · ${dateLabel}`,
          isUnnamed: existing ? existing.isUnnamed : true,
          partnerId: partnerId||null,
          fromTogether: true,
          stage: roomState.stage||null,
          activeCats: roomState.activeCats||[],
          spicyLevel: roomState.spicyLevel||0,
          seen: mergedSeen,
          totalPlayed: mergedSeen.length,
          updatedAt: Date.now(),
        }
      };
    });
  },[roomState,isHost]);

  // Seed a connected room from local saved progress for this partner, once
  // per session. Both devices merge their own saved history into the room,
  // so the union of past play carries forward.
  const seededRef = useRef(false);
  useEffect(()=>{
    if(roomStatus!=="connected"){ seededRef.current=false; return; }
    if(seededRef.current || !roomState || !roomCode) return;
    const partnerId = isHost ? roomState.guestId : roomState.hostId;
    if(!partnerId) return;
    seededRef.current = true;
    const localSave = Object.values(saves).find(s=>s && s.partnerId===partnerId);
    if(localSave?.seen?.length){
      const current = roomState.seenQuestions||[];
      const merged = Array.from(new Set([...current, ...localSave.seen]));
      if(merged.length > current.length){
        syncAction({seenQuestions:merged});
      }
    }
  },[roomStatus,roomState,roomCode,isHost,saves,syncAction]);



  const GF_TITLE = {fontFamily:"'Cormorant Garamond',serif",fontWeight:400,fontStyle:"normal"};

  const pool = buildPool(activeCats, relationshipType, spicyLevel);
  // Only show category pills that have questions for the current stage
  const availableCats = relationshipType
    ? CATEGORY_ORDER.filter(cat => ALL_QUESTIONS.some(q => {
        const stageIdx = STAGE_ORDER.indexOf(relationshipType);
        const minIdx = STAGE_ORDER.indexOf(q.stageMin);
        const maxIdx = q.stageMax ? STAGE_ORDER.indexOf(q.stageMax) : 3;
        return q.category === cat && stageIdx >= minIdx && stageIdx <= maxIdx;
      }))
    : CATEGORY_ORDER;
  const currentStage = RELATIONSHIP_TYPES.find(r=>r.id===relationshipType);
  // Build a readable deck preview string for the connected screen
  const spicyLabels = ["", "Mild", "Medium", "Hot"];
  const deckPreview = (()=>{
    const parts = [];
    if(roomState?.stage){
      const st = RELATIONSHIP_TYPES.find(r=>r.id===roomState.stage);
      if(st) parts.push(st.label);
    }
    const cats = roomState?.activeCats || [];
    if(cats.length===1) parts.push(cats[0]);
    else if(cats.length>1) parts.push(`${cats.length} categories`);
    if(roomState?.spicyLevel>0) parts.push(spicyLabels[roomState.spicyLevel]);
    return parts.join(" · ");
  })();
  const showPerspectiveToggle = !!(current?.canFlip && (relationshipType==="were_a_thing"||relationshipType==="committed"));
  const displayQuestion = current ? (perspectiveFlipped && current.perspectiveQ ? current.perspectiveQ : current.question) : "";
  const catData = current ? CATEGORIES[current.category] : null;
  const cardBg = catData?.cardBg||"#F5EDE0";
  const cardBorder = catData?.cardBorder||"#E8DDD0";
  const unseenCount = pool.filter(q=>!seenQuestions.has(q.question)).length;

  const markSeen = useCallback((question)=>{setSeenQuestions(prev=>{const next=new Set(prev);next.add(question);return next;});setTotalPlayed(t=>t+1);},[]);

  const initPlay = useCallback((cats)=>{
    const usedCats=cats||activeCats;
    const p=buildPool(usedCats,relationshipType,spicyLevel);
    if(!p.length)return;
    const first=pickNextUnseen(p,seenQuestions,"");
    const second=pickNextUnseen(p,seenQuestions,first?.question||"");
    setCurrent(first);setNextCard(second);setFlipped(false);setCount(1);setDragX(0);setGone(false);setIsDragging(false);setDeckExhausted(!first);setScreen("play");
  },[activeCats,seenQuestions,relationshipType,spicyLevel]);

  // Starting a game from the deck builder always plays the unnamed Last game,
  // so named saves are never overwritten. If returning from a named save,
  // reload the Last game's own history first.
  const startFromDeck = useCallback(()=>{
    if(activeSaveId!==LAST_GAME_ID){
      const lg = saves[LAST_GAME_ID];
      const lgSeen = new Set(lg?.seen||[]);
      setActiveSaveId(LAST_GAME_ID);
      setSeenQuestions(lgSeen);
      setTotalPlayed(lg?.totalPlayed||0);
      const p = buildPool(activeCats, relationshipType, spicyLevel);
      const first = pickNextUnseen(p, lgSeen, "");
      const second = pickNextUnseen(p, lgSeen, first?.question||"");
      setCurrent(first); setNextCard(second);
      setFlipped(false); setCount(1); setDragX(0); setGone(false); setIsDragging(false); setDeckExhausted(!first);
      setScreen("play");
    } else {
      initPlay();
    }
  },[activeSaveId,saves,activeCats,relationshipType,spicyLevel,initPlay]);

  const advance = useCallback(()=>{
    if(!current)return;
    const cq=current.question;
    markSeen(cq);
    const p=buildPool(activeCats,relationshipType,spicyLevel);
    const newSeen=new Set(seenQuestions);
    newSeen.add(cq);
    // A park-for-later card, once answered, leaves the parked queue for good.
    let newLater=parkedLater;
    if(parkedLater.has(cq)){ newLater=new Set(parkedLater); newLater.delete(cq); setParkedLater(newLater); }
    // No card queued behind this one -- the deck is exhausted
    if(!nextCard){
      setCurrent(null);setNextCard(null);setFlipped(false);setDragX(0);setGone(false);setIsDragging(false);hasDragged.current=false;setPerspectiveFlipped(false);setDeckExhausted(true);
      return;
    }
    const {pick,queue}=pickSolo(p,newSeen,newLater,parkedForStage,stageQueue,nextCard.question);
    if(queue!==stageQueue) setStageQueue(queue);
    setCurrent(nextCard);setNextCard(pick);setFlipped(false);setCount(c=>c+1);setDragX(0);setGone(false);setIsDragging(false);hasDragged.current=false;setPerspectiveFlipped(false);
  },[nextCard,current,activeCats,seenQuestions,markSeen,relationshipType,spicyLevel,parkedLater,parkedForStage,stageQueue]);

  // Park the current card without burning it as seen.
  //  mode "later" -> comes back at the end of this deck
  //  mode "stage" -> held out, surfaces at the front of the next stage
  const parkCard = useCallback((mode)=>{
    setShowPark(false);
    if(!current) return;
    const cq=current.question;
    const p=buildPool(activeCats,relationshipType,spicyLevel);
    let newLater=parkedLater, newStage=parkedForStage;
    if(mode==="stage"){
      newStage=new Set(parkedForStage); newStage.add(cq); setParkedForStage(newStage);
    } else {
      newLater=new Set(parkedLater); newLater.add(cq); setParkedLater(newLater);
    }
    // Move past the parked card. Excluding cq stops it reappearing immediately.
    if(nextCard){
      const {pick,queue}=pickSolo(p,seenQuestions,newLater,newStage,stageQueue,nextCard.question);
      setStageQueue(queue);
      setCurrent(nextCard);setNextCard(pick);
    } else {
      const r1=pickSolo(p,seenQuestions,newLater,newStage,stageQueue,cq);
      if(!r1.pick){
        setStageQueue(r1.queue);
        setCurrent(null);setNextCard(null);setFlipped(false);setDragX(0);setGone(false);setIsDragging(false);hasDragged.current=false;setPerspectiveFlipped(false);setDeckExhausted(true);
        return;
      }
      const r2=pickSolo(p,seenQuestions,newLater,newStage,r1.queue,r1.pick.question);
      setStageQueue(r2.queue);
      setCurrent(r1.pick);setNextCard(r2.pick);
    }
    setFlipped(false);setCount(c=>c+1);setDragX(0);setGone(false);setIsDragging(false);hasDragged.current=false;setPerspectiveFlipped(false);
  },[current,nextCard,activeCats,relationshipType,spicyLevel,seenQuestions,parkedLater,parkedForStage,stageQueue]);

  // Dev shortcut: force the current deck to its exhaustion screen.
  const devExhaust=()=>{
    if(screen==="connected-play" && roomCode){ syncAction({currentQuestion:null,nextQuestion:null}); return; }
    setCurrent(null); setNextCard(null); setFlipped(false); setDeckExhausted(true);
  };

  // Start a clean game in a fresh unnamed "Last game" slot
  const doResetFresh=()=>{
    setActiveSaveId(LAST_GAME_ID);
    setSeenQuestions(new Set());
    setTotalPlayed(0);
    setParkedLater(new Set()); setParkedForStage(new Set()); setStageQueue([]);
    setSaves(prev=>({...prev,[LAST_GAME_ID]:{id:LAST_GAME_ID,name:"Last game",isUnnamed:true,stage:relationshipType,activeCats,spicyLevel,seen:[],totalPlayed:0,parkedLater:[],parkedForStage:[],stageQueue:[],updatedAt:Date.now()}}));
    setShowReset(false);
    setOverwritePromptOpen(false);
    setDeckExhausted(false);
    initPlay();
  };
  // Entry point for any "start fresh" action -- warns if an unnamed
  // Last game with progress would be overwritten
  const requestReset=()=>{
    setShowReset(false);
    if(lastGameHasProgress){
      setNameInput("");
      setOverwritePromptOpen(true);
    } else {
      doResetFresh();
    }
  };
  const handleReset=requestReset;
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
          <div style={{background:"#FBF5EC",borderRadius:20,padding:"32px 32px",width:"100%",maxWidth:340,maxHeight:"85vh",overflowY:"auto",textAlign:"center"}}>
            <TextureButton style={{width:"100%",marginBottom:12}} onClick={replayTutorial}>How to play</TextureButton>
            <button onClick={()=>{const next=!muted;audio.setMuted(next);setMuted(next);if(!next)audio.click();}} style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",
              background:"transparent",border:"1.5px solid #C4A882",borderRadius:100,padding:"14px 32px",
              cursor:"pointer",marginBottom:12,
            }}>
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:500,letterSpacing:"0.14em",textTransform:"uppercase",color:"#5C3418"}}>Sound</span>
              <span style={{position:"relative",width:38,height:22,borderRadius:11,background:muted?"#E0D5C4":"#5C3418",transition:"background 0.18s",flexShrink:0}}>
                <span style={{position:"absolute",top:2,left:muted?2:18,width:18,height:18,borderRadius:9,background:"#FBF5EC",transition:"left 0.18s",boxShadow:"0 1px 2px rgba(54,28,8,0.25)"}}/>
              </span>
            </button>
            <TextureButton variant="ghost" style={{width:"100%",padding:"14px 32px",marginBottom:12}} onClick={()=>{setShowInfo(false);setShowChangeRel(true);}}>
              Change relationship
            </TextureButton>
            <TextureButton variant="ghost" style={{width:"100%",padding:"14px 32px",marginBottom:12}} onClick={()=>{setShowInfo(false);setShowReset(true);}}>
              Reset progress{seenQuestions.size>0?` · ${seenQuestions.size} seen`:""}
            </TextureButton>
            <button onClick={()=>setShowInfo(false)} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#B8A888",marginTop:4,display:"block",width:"100%"}}>Close</button>
          </div>
        </div>
      )}

      {DEV && (screen==="play"||screen==="connected-play") && (
        <button onClick={devExhaust} style={{position:"fixed",left:12,bottom:12,zIndex:200,background:"#3C2410",color:"#F5EDD9",border:"none",borderRadius:8,padding:"6px 11px",fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.04em",opacity:0.8,cursor:"pointer"}}>⏭ END</button>
      )}

      {/* ── PARK PROMPT ── */}
      {showPark&&(()=>{
        const idx = relationshipType ? STAGE_ORDER.indexOf(relationshipType) : -1;
        const nextStage = (idx>=0 && idx<STAGE_ORDER.length-1) ? RELATIONSHIP_TYPES.find(r=>r.id===STAGE_ORDER[idx+1]) : null;
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(44,35,24,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:110,padding:24}} onClick={()=>setShowPark(false)}>
            <div style={{background:"#FBF5EC",borderRadius:20,padding:"32px 28px",width:"100%",maxWidth:340,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
              <p style={{...GF_TITLE,fontSize:23,color:"#3C2010",marginBottom:8}}>Not right now?</p>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840",lineHeight:1.6,marginBottom:24}}>Set this card aside without losing it.</p>
              <TextureButton style={{width:"100%",marginBottom:12}} onClick={()=>parkCard("later")}>Park for later</TextureButton>
              {nextStage&&(
                <TextureButton variant="ghost" style={{width:"100%",padding:"14px 28px",marginBottom:12}} onClick={()=>parkCard("stage")}>
                  Save for {nextStage.label}
                </TextureButton>
              )}
              <button onClick={()=>setShowPark(false)} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#B8A888",letterSpacing:"0.02em",marginTop:4}}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* ── CHANGE RELATIONSHIP PICKER ── */}
      {showChangeRel&&(
        <div style={{position:"fixed",inset:0,background:"rgba(44,35,24,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:110,padding:24}} onClick={()=>setShowChangeRel(false)}>
          <div style={{background:"#FBF5EC",borderRadius:20,padding:"36px 28px",width:"100%",maxWidth:360,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <p style={{...GF_TITLE,fontSize:24,color:"#3C2010",marginBottom:6}}>Change relationship</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840",lineHeight:1.6,marginBottom:22}}>Your history carries over, so you'll only see questions you haven't answered yet.</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {RELATIONSHIP_TYPES.map(rel=>{
                const isCurrent = rel.id===relationshipType;
                const newCount = newCountForStage(rel.id);
                return(
                  <button key={rel.id} disabled={isCurrent} onClick={()=>changeRelationship(rel.id)} style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",
                    background:isCurrent?"#EFE6D8":"#FFFFFF",border:`1.5px solid ${isCurrent?"#D8C9B4":"#E8DDD0"}`,
                    borderRadius:14,padding:"13px 18px",cursor:isCurrent?"default":"pointer",textAlign:"left",opacity:isCurrent?0.7:1,
                  }}>
                    <div>
                      <p style={{...GF_TITLE,fontSize:18,color:"#3C2010",lineHeight:1.2}}>{rel.label}</p>
                      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#A08868",marginTop:3}}>
                        {isCurrent?"Current stage":`${newCount} new ${newCount===1?"question":"questions"}`}
                      </p>
                    </div>
                    {!isCurrent&&(
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <button onClick={()=>setShowChangeRel(false)} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#B8A888",marginTop:18,width:"100%"}}>Cancel</button>
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

      {/* ── SAVED GAMES LIST ── */}
      {showSavedGames&&(
        <div style={{position:"fixed",inset:0,background:"rgba(44,35,24,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24}} onClick={()=>setShowSavedGames(false)}>
          <div style={{background:"#FBF5EC",borderRadius:20,padding:"32px 24px",width:"100%",maxWidth:360,maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <p style={{...GF_TITLE,fontSize:24,color:"#3C2010",textAlign:"center",marginBottom:4}}>Saved games</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#A08868",textAlign:"center",marginBottom:24}}>Pick up where you left off</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {Object.values(saves)
                .filter(s=>s && (s.seen?.length || s.totalPlayed))
                .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))
                .map(s=>{
                  const st = RELATIONSHIP_TYPES.find(r=>r.id===s.stage);
                  const seenN = s.seen?.length||0;
                  return(
                    <div key={s.id} style={{
                      display:"flex",alignItems:"center",width:"100%",
                      background:"#FFFFFF",border:"1.5px solid #E8DDD0",borderRadius:14,overflow:"hidden",
                    }}>
                      <button onClick={()=>restoreSave(s.id)} style={{
                        flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",
                        background:"none",border:"none",padding:"14px 16px",cursor:"pointer",textAlign:"left",
                      }}>
                        <div>
                          <p style={{...GF_TITLE,fontSize:18,color:"#3C2010",lineHeight:1.2}}>{s.name||"Last game"}</p>
                          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#A08868",marginTop:3}}>
                            {st?`${st.label} · `:""}{seenN} played
                          </p>
                        </div>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </button>
                      <button onClick={()=>setDeleteSaveTarget({id:s.id,name:s.name||"Last game"})} aria-label="Delete" style={{
                        background:"none",border:"none",borderLeft:"1px solid #F0E8DC",padding:"14px 16px",cursor:"pointer",flexShrink:0,
                      }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C49A8A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
            </div>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#B0A090",textAlign:"center",lineHeight:1.6,marginTop:20}}>Saved games live on the device they were played on.</p>
            <button onClick={()=>setShowSavedGames(false)} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#B8A888",marginTop:16,width:"100%"}}>Close</button>
          </div>
        </div>
      )}

      {/* ── DELETE SAVE CONFIRM ── */}
      {deleteSaveTarget&&(
        <div style={{position:"fixed",inset:0,background:"rgba(44,35,24,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:120,padding:24}}>
          <div style={{background:"#FBF5EC",borderRadius:20,padding:"36px 28px",width:"100%",maxWidth:320,textAlign:"center"}}>
            <p style={{...GF_TITLE,fontSize:22,color:"#3C2010",marginBottom:10}}>Delete this game?</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840",lineHeight:1.6,marginBottom:24}}>"{deleteSaveTarget.name}" and its progress will be removed from this device. This can't be undone.</p>
            <TextureButton style={{width:"100%",marginBottom:10}} onClick={()=>deleteSave(deleteSaveTarget.id)}>Delete</TextureButton>
            <TextureButton variant="ghost" style={{width:"100%",padding:"12px 32px"}} onClick={()=>setDeleteSaveTarget(null)}>Keep it</TextureButton>
          </div>
        </div>
      )}

      {/* ── NAME PROMPT (after restoring Last game) ── */}
      {namePromptOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(44,35,24,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:110,padding:24}}>
          <div style={{background:"#FBF5EC",borderRadius:20,padding:"36px 28px",width:"100%",maxWidth:340,textAlign:"center"}}>
            <p style={{...GF_TITLE,fontSize:22,color:"#3C2010",marginBottom:8}}>Name this game?</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840",lineHeight:1.6,marginBottom:20}}>Give it a name to keep it separate from other games you play.</p>
            <input
              value={nameInput}
              onChange={e=>setNameInput(e.target.value)}
              placeholder="Who are you playing with?"
              style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #DDD0BC",borderRadius:12,padding:"12px 16px",fontFamily:"'DM Sans',sans-serif",fontSize:16,color:"#3C2010",background:"#FFFFFF",outline:"none",marginBottom:16,textAlign:"center"}}
            />
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#A08868",lineHeight:1.6,marginBottom:20}}>Games you save while playing on one device are stored on that device only. Play Together sessions save to both phones automatically. To continue a solo save later, start from this same device.</p>
            <TextureButton style={{width:"100%",marginBottom:10}} onClick={()=>{if(nameInput.trim()){const newId=nameSave(nameInput,namingSaveId);if(newId)setActiveSaveId(newId);}setNamePromptOpen(false);}}>Save</TextureButton>
            <TextureButton variant="ghost" style={{width:"100%",padding:"12px 32px"}} onClick={()=>setNamePromptOpen(false)}>Skip for now</TextureButton>
          </div>
        </div>
      )}

      {/* ── OVERWRITE PROTECTION (reset would replace unnamed Last game) ── */}
      {overwritePromptOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(44,35,24,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:110,padding:24}}>
          <div style={{background:"#FBF5EC",borderRadius:20,padding:"36px 28px",width:"100%",maxWidth:340,textAlign:"center"}}>
            <p style={{...GF_TITLE,fontSize:22,color:"#3C2010",marginBottom:8}}>Keep your last game?</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840",lineHeight:1.6,marginBottom:20}}>Starting fresh will overwrite "Last game". Name it to keep it, or continue and it'll be replaced.</p>
            <input
              value={nameInput}
              onChange={e=>setNameInput(e.target.value)}
              placeholder="Name to keep it"
              style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #DDD0BC",borderRadius:12,padding:"12px 16px",fontFamily:"'DM Sans',sans-serif",fontSize:16,color:"#3C2010",background:"#FFFFFF",outline:"none",marginBottom:16,textAlign:"center"}}
            />
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#A08868",lineHeight:1.6,marginBottom:20}}>Games you save while playing on one device are stored on that device only. Play Together sessions save to both phones automatically. To continue a solo save later, start from this same device.</p>
            <TextureButton disabled={!nameInput.trim()} style={{width:"100%",marginBottom:10}} onClick={()=>{nameSave(nameInput,LAST_GAME_ID);doResetFresh();}}>Name & keep</TextureButton>
            <TextureButton variant="ghost" style={{width:"100%",padding:"12px 32px"}} onClick={()=>doResetFresh()}>Continue, replace it</TextureButton>
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
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            <TextureButton onClick={()=>setScreen("deck")}>Build your deck</TextureButton>
            <TextureButton variant="ghost" style={{padding:"12px 48px"}} onClick={()=>{setTogetherMode(false);setScreen("together");}}>Play together →</TextureButton>
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
            <button className="btn-back-arrow" onClick={()=>{if(togetherMode){setTogetherMode(false);setScreen("together");}else{setScreen("home");}}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A08868" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
          </div>
          {/* Heading with generous space */}
          <div style={{width:"100%",textAlign:"center",paddingTop:32,paddingBottom:32}}>
            <p style={{...GF_TITLE,fontSize:30,color:"#3C2010",lineHeight:1.3,marginBottom:10}}>Where are you in your relationship?</p>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#A08868"}}>We'll suggest the right questions</p>
          </div>
          {/* Continue a saved game -- only when saves exist */}
          {hasAnySaves && (
            <button onClick={()=>setShowSavedGames(true)} style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%",
              background:"#FBF5EC",border:"1.5px solid #DDD0BC",borderRadius:14,padding:"14px 20px",
              cursor:"pointer",marginBottom:28,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B6445" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,color:"#5A4030",letterSpacing:"0.03em"}}>Continue a saved game</span>
            </button>
          )}
          <div style={{display:"flex",gap:10,width:"100%",marginBottom:32}}>
            {RELATIONSHIP_TYPES.map(rel=>(
              <RelTile key={rel.id} rel={rel} isActive={relationshipType===rel.id} onClick={()=>{if(relationshipType===rel.id){setRelationshipType(null);setActiveCats([...CATEGORY_ORDER]);setSpicyLevel(0);}else{const validCats=CATEGORY_ORDER.filter(cat=>ALL_QUESTIONS.some(q=>{const si=STAGE_ORDER.indexOf(rel.id);const mi=STAGE_ORDER.indexOf(q.stageMin);const mx=q.stageMax?STAGE_ORDER.indexOf(q.stageMax):3;return q.category===cat&&si>=mi&&si<=mx;}));setRelationshipType(rel.id);setActiveCats(validCats);setSpicyLevel(0);}}}/>
            ))}
          </div>
          {relationshipType && (currentStage?.spicyMax||0) > 0 && (
            <div style={{marginBottom:28,display:"flex",justifyContent:"center"}}>
              <SpicyToggle level={spicyLevel} onCycle={()=>{const max=RELATIONSHIP_TYPES.find(r=>r.id===relationshipType)?.spicyMax||0;setSpicyLevel(l=>(l>=max?0:l+1));}} stageId={relationshipType}/>
            </div>
          )}
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#6B4A30",textAlign:"center",marginBottom:16,letterSpacing:"0.02em"}}>
            {relationshipType?"Fine tune your deck":"Or choose categories manually"}
          </p>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:36}}>
            {Array.from({length:Math.ceil(CATEGORY_ORDER.length/3)}).map((_,rowIdx)=>(
              <div key={rowIdx} style={{display:"flex",gap:8,justifyContent:"center"}}>
                {CATEGORY_ORDER.slice(rowIdx*3,(rowIdx+1)*3).map(cat=>(
                  <TexturePill key={cat} cat={cat} isOn={activeCats.includes(cat)} disabled={!availableCats.includes(cat)} onClick={()=>toggleCat(cat)}/>
                ))}
              </div>
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
          <TextureButton disabled={pool.length===0} onClick={async()=>{
            if(togetherMode){
              // Building deck for Play Together -- create room with this config.
              // Seed seen-history from the continued save (empty for a fresh game).
              const seedSet=new Set(togetherSeedSeen);
              const first=pickNextUnseen(pool,seedSet,"");
              const second=pickNextUnseen(pool,seedSet,first?.question||"");
              await createRoom({stage:relationshipType,spicyLevel,activeCats,currentQuestion:first,nextQuestion:second,seenQuestions:togetherSeedSeen,hostName:playerName.trim()});
              setCurrent(first);setNextCard(second);
              setScreen("together");
            } else if(!hasSeenTutorial){
              setTutStep(0);setTutorialFrom("deck");setScreen("tutorial");
            } else {
              startFromDeck();
            }
          }}>
            {togetherMode ? "Create room" : `Play · ${unseenCount} new questions`}
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
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,width:"100%",flexShrink:0}}>
            {Array.from({length:Math.ceil(CATEGORY_ORDER.length/3)}).map((_,rowIdx)=>(
              <div key={rowIdx} style={{display:"flex",gap:6,justifyContent:"center"}}>
                {CATEGORY_ORDER.slice(rowIdx*3,(rowIdx+1)*3).map(cat=>(
                  <TexturePill key={cat} cat={cat} isOn={activeCats.includes(cat)} onClick={()=>toggleCat(cat)}/>
                ))}
              </div>
            ))}
          </div>
          {relationshipType && (currentStage?.spicyMax||0) > 0 && (
            <div style={{display:"flex",justifyContent:"center",marginTop:6,flexShrink:0}}>
              <SpicyToggle level={spicyLevel} onCycle={()=>{const max=RELATIONSHIP_TYPES.find(r=>r.id===relationshipType)?.spicyMax||0;setSpicyLevel(l=>(l>=max?0:l+1));}} stageId={relationshipType}/>
            </div>
          )}
          {/* 50px gap pills to card */}
          <div style={{height:50,flexShrink:0}}/>
          {/* Card — fixed vh height so it never pushes stats off screen */}
          <div style={{position:"relative",width:"100%",maxWidth:340,height:"55vh",maxHeight:460,flexShrink:0,marginBottom:8}}>
            {nextCard&&!deckExhausted&&(
              <div style={{position:"absolute",inset:0,transform:"scale(0.95) translateY(10px)",transformOrigin:"bottom center",opacity:1,pointerEvents:"none",zIndex:1}}>
                <CardBack/>
              </div>
            )}
            {deckExhausted&&(()=>{
              const idx = STAGE_ORDER.indexOf(relationshipType);
              const nextId = STAGE_ORDER[idx+1];
              const nextStage = RELATIONSHIP_TYPES.find(r=>r.id===nextId);
              const wrap = (children)=>(
                <div style={{position:"absolute",inset:0,zIndex:2,background:"#F5EDE0",border:"1.5px solid #E8DDD0",borderRadius:20,padding:"28px 24px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",overflowY:"auto",boxShadow:"-4px 12px 40px rgba(54,28,8,0.16)"}}>
                  <div style={{position:"absolute",inset:10,border:"1px solid rgba(180,160,140,0.25)",borderRadius:12,pointerEvents:"none"}}/>
                  {children}
                </div>
              );
              const heading=(t)=><p style={{...GF_TITLE,fontSize:25,color:"#3C2010",lineHeight:1.3,marginBottom:12}}>{t}</p>;
              const body=(t)=><p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#A08868",lineHeight:1.7,marginBottom:22,maxWidth:264}}>{t}</p>;
              const primaryStyle={width:"100%",maxWidth:280,padding:"13px 24px",marginBottom:10};
              const connexionBtn=<TextureButton variant="ghost" style={primaryStyle} onClick={openConnexion}>Explore other Connexion Studio apps</TextureButton>;
              const resetLink=(label,fn)=><button onClick={fn} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#B8A888",letterSpacing:"0.04em",textDecoration:"underline",textUnderlineOffset:"3px",marginTop:6}}>{label}</button>;
              const curLabel=RELATIONSHIP_TYPES.find(r=>r.id===relationshipType)?.label;

              // No stage selected (manual category deck) -- simple completion
              if(!relationshipType){
                return wrap(<>
                  {heading("You've completed the deck!")}
                  {body("You've worked your way through every question in this deck. The conversations and connections you've built are what matter most.")}
                  {connexionBtn}
                  {resetLink("Reset questions", replayCurrent)}
                </>);
              }

              // Friends & groups -- sideways invite to the couples track
              if(relationshipType==="friends"){
                return wrap(<>
                  {heading("You've explored it all!")}
                  {body("Looking to go deeper? Explore the couple decks with your partner and discover a whole new level of connection.")}
                  <TextureButton style={primaryStyle} onClick={()=>changeRelationship("just_together")}>Explore couple questions</TextureButton>
                  {connexionBtn}
                  {resetLink("Reset questions", replayCurrent)}
                </>);
              }

              // Long-term connection -- top stage, completion message
              if(!nextStage){
                return wrap(<>
                  {heading("You've shared it all… for now!")}
                  {body("You've explored every Long-term connection question, hundreds of conversations worth having. New questions are on the way. Until then, revisit your favourites and see what feels different.")}
                  <TextureButton style={primaryStyle} onClick={replayCurrent}>Replay Long-term connection</TextureButton>
                  {connexionBtn}
                  {resetLink("Reset all questions", requestReset)}
                </>);
              }

              // Learning each other / Building on history -- guided step up
              return wrap(<>
                {heading("Ready to go deeper?")}
                {body(`You've explored every ${curLabel} question. Continue your journey with ${nextStage.label}.`)}
                <TextureButton style={primaryStyle} onClick={()=>changeRelationship(nextId)}>Move to {nextStage.label}</TextureButton>
                {connexionBtn}
                {resetLink("Reset questions", replayCurrent)}
              </>);
            })()}
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
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <SpicyBadge level={current.spicy}/>
                      <button onClick={(e)=>{e.stopPropagation();audio.click();setShowPark(true);}} style={{background:"transparent",border:"1px solid #C4A882",borderRadius:100,padding:"4px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"all 0.2s"}}>
                        <svg width="9" height="11" viewBox="0 0 9 11" fill="none" style={{flexShrink:0}}><path d="M1 1.5h7v8L4.5 7 1 9.5v-8z" stroke="#8B6445" strokeWidth="1.1" strokeLinejoin="round"/></svg>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:"#8B6445",fontWeight:500}}>Park</span>
                      </button>
                    </div>
                  </div>
                  <p style={{...GF_TITLE,fontSize:20,lineHeight:1.6,color:"#2C1808",flex:1,display:"flex",alignItems:"center",paddingTop:10,textAlign:"left"}}>
                    {displayQuestion}
                  </p>
                  {showPerspectiveToggle&&(
                    <div style={{display:"flex",justifyContent:"flex-end",paddingTop:8}}>
                      <button onClick={(e)=>{e.stopPropagation();setPerspectiveFlipped(v=>!v);}} style={{background:perspectiveFlipped?"#3C2410":"transparent",border:"1px solid #C4A882",borderRadius:100,padding:"4px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"all 0.2s"}}>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:perspectiveFlipped?"#F5EDD9":"#8B6445",fontWeight:500}}>Flip</span>
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

      {/* ── PLAY TOGETHER ── */}
      {screen==="together"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:460,boxSizing:"border-box",paddingLeft:24,paddingRight:24,paddingTop:"calc(env(safe-area-inset-top) + 52px)",paddingBottom:"calc(env(safe-area-inset-bottom) + 32px)"}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <h1 style={{...GF_TITLE,fontSize:40,color:"#3C2010",lineHeight:1}}>Play Together</h1>
            <p style={{...GF_TITLE,marginTop:8,fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase",color:"#A08868"}}>Same card. Different cities.</p>
          </div>
          {/* Name input */}
          {!roomCode && (
            <div style={{width:"100%",marginBottom:24}}>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#7A5840",marginBottom:8,letterSpacing:"0.04em"}}>Your name</p>
              <input
                value={playerName}
                onChange={e=>setPlayerName(e.target.value)}
                placeholder="So they know you're there"
                style={{width:"100%",border:"1.5px solid #DDD0BC",borderRadius:12,padding:"12px 16px",fontFamily:"'DM Sans',sans-serif",fontSize:16,color:"#3C2010",background:"#FBF5EC",outline:"none"}}
              />
            </div>
          )}
          {!roomCode && (
            <div style={{width:"100%",display:"flex",flexDirection:"column",gap:12}}>
              <TextureButton style={{width:"100%"}} onClick={()=>{
                if(!playerName.trim())return;
                setTogetherSeedSeen([]);
                setTogetherMode(true);
                setScreen("deck");
              }}>
                Create a room
              </TextureButton>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input
                  value={joinCodeInput}
                  onChange={e=>setJoinCodeInput(e.target.value.replace(/\D/g,"").slice(0,4))}
                  placeholder="Enter 4-digit code"
                  maxLength={4}
                  inputMode="numeric"
                  style={{flex:1,border:"1.5px solid #DDD0BC",borderRadius:12,padding:"12px 16px",fontFamily:"'DM Sans',sans-serif",fontSize:18,color:"#3C2010",background:"#FBF5EC",outline:"none",textAlign:"center",letterSpacing:"0.2em"}}
                />
                <TextureButton style={{padding:"16px 24px",flexShrink:0}} onClick={async()=>{
                  if(!playerName.trim()||joinCodeInput.length!==4)return;
                  const ok=await joinRoom(joinCodeInput);
                  if(ok){
                    resetPlayState();
                    // Stay on together screen -- the connected state will show
                    // deck preview and Start Playing button for the guest
                  }
                }}>Join</TextureButton>
              </div>
              {roomError&&<p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#B84A1A",textAlign:"center"}}>{roomError}</p>}
            </div>
          )}
          {/* Waiting for partner */}
          {roomCode && roomStatus==="waiting" && (
            <div style={{textAlign:"center",width:"100%"}}>
              <div style={{background:"#FBF5EC",border:"1.5px solid #DDD0BC",borderRadius:20,padding:"40px 32px",marginBottom:24}}>
                <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#A08868",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>Your room code</p>
                <p style={{...GF_TITLE,fontSize:64,color:"#3C2010",letterSpacing:"0.2em",lineHeight:1}}>{roomCode}</p>
                <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840",marginTop:16,marginBottom:24}}>Share this with your person</p>
                <button onClick={async()=>{
                  const msg = `Join me on Go First! Enter code ${roomCode} at go-first-gamma.vercel.app`;
                  if(navigator.share){
                    try{ await navigator.share({title:"Go First",text:msg}); }catch(e){}
                  } else {
                    try{ await navigator.clipboard.writeText(msg); alert("Code copied!"); }catch(e){}
                  }
                }} style={{
                  display:"flex",alignItems:"center",gap:8,margin:"0 auto",
                  background:"#3C2010",color:"#F5EDD9",
                  border:"none",borderRadius:100,padding:"10px 24px",
                  fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:500,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5EDD9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  Share code
                </button>
              </div>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#A08868"}}>Waiting for them to join...</p>
            </div>
          )}
          {/* Connected -- both players see this, with deck preview */}
          {roomCode && roomStatus==="connected" && (
            <div style={{textAlign:"center",width:"100%"}}>
              <div style={{background:"#FBF5EC",border:"1.5px solid #DDD0BC",borderRadius:20,padding:"32px",marginBottom:24}}>
                <p style={{...GF_TITLE,fontSize:24,color:"#3C2010",marginBottom:8}}>You're connected</p>
                <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#7A5840",marginBottom:deckPreview?16:0}}>Both devices are ready</p>
                {deckPreview && (
                  <div style={{marginTop:8,paddingTop:16,borderTop:"1px solid #EADFD0"}}>
                    <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,letterSpacing:"0.14em",textTransform:"uppercase",color:"#A08868",marginBottom:6}}>{isHost?"Your deck":"You're joining"}</p>
                    <p style={{...GF_TITLE,fontSize:17,color:"#5A4030"}}>{deckPreview}</p>
                  </div>
                )}
              </div>
              <TextureButton style={{width:"100%"}} onClick={()=>{
                resetPlayState();
                if(roomState?.currentQuestion){setCurrent(roomState.currentQuestion);setNextCard(roomState.nextQuestion);}
                setScreen("connected-play");
              }}>Start playing</TextureButton>
            </div>
          )}
          <button onClick={()=>{leaveRoom();setTogetherMode(false);setScreen("home");}} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#B8A888",marginTop:24}}>← Back</button>
        </div>
      )}

            {/* ── CONNECTED PLAY ── */}
      {screen==="connected-play"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:460,height:"100vh",maxHeight:"100vh",boxSizing:"border-box",paddingLeft:12,paddingRight:12,paddingTop:"calc(env(safe-area-inset-top) + 8px)",paddingBottom:"calc(env(safe-area-inset-bottom) + 10px)"}}>
          {/* Header */}
          <div style={{width:"100%",paddingBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <button className="btn-back-arrow" onClick={()=>{saveTogetherProgress();leaveRoom();setScreen("deck");}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A08868" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:roomStatus==="connected"?"#5A8A5A":"#C4A882"}}/>
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#7A5840",letterSpacing:"0.04em"}}>
                {roomStatus==="connected"?"Connected":roomStatus==="waiting"?"Waiting...":"Disconnected"} · Room {roomCode}
              </span>
            </div>
            <div style={{width:28}}/>
          </div>
          {/* Category pills -- synced to room */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,width:"100%",flexShrink:0}}>
            {Array.from({length:Math.ceil(CATEGORY_ORDER.length/3)}).map((_,rowIdx)=>(
              <div key={rowIdx} style={{display:"flex",gap:6,justifyContent:"center"}}>
                {CATEGORY_ORDER.slice(rowIdx*3,(rowIdx+1)*3).map(cat=>(
                  <TexturePill key={cat} cat={cat} isOn={activeCats.includes(cat)} onClick={()=>{
                    const next = activeCats.includes(cat)
                      ? (activeCats.length<=1 ? activeCats : activeCats.filter(c=>c!==cat))
                      : [...activeCats, cat];
                    setActiveCats(next);
                    syncAction({activeCats:next});
                  }}/>
                ))}
              </div>
            ))}
          </div>
          {relationshipType && (currentStage?.spicyMax||0) > 0 && (
            <div style={{display:"flex",justifyContent:"center",marginTop:6,flexShrink:0}}>
              <SpicyToggle level={spicyLevel} onCycle={()=>{
                const max=RELATIONSHIP_TYPES.find(r=>r.id===relationshipType)?.spicyMax||0;
                const next = spicyLevel>=max ? 0 : spicyLevel+1;
                setSpicyLevel(next);
                syncAction({spicyLevel:next});
              }} stageId={relationshipType}/>
            </div>
          )}
          <div style={{height:50,flexShrink:0}}/>
          {/* Synced card with swipe */}
          {(()=>{
            const syncedQ=roomState?.currentQuestion||current;
            const syncedFlipped=roomState?.flipped||false;
            const syncedPerspective=roomState?.perspectiveFlipped||false;
            const syncedDisplay=syncedQ?(syncedPerspective&&syncedQ.perspectiveQ?syncedQ.perspectiveQ:syncedQ.question):"";
            const syncedCatData=syncedQ?CATEGORIES[syncedQ.category]:null;
            const syncedBg=syncedCatData?.cardBg||"#F5EDE0";
            const syncedBorder=syncedCatData?.cardBorder||"#E8DDD0";
            const advanceRoom=async()=>{
              audio.resume();audio.swipe();
              const pool=buildPool(activeCats,relationshipType,spicyLevel);
              const newSeen=[...(roomState?.seenQuestions||[]),syncedQ?.question].filter(Boolean);
              const upcoming=pickNextUnseen(pool,new Set(newSeen),roomState?.nextQuestion?.question||"");
              await syncAction({currentQuestion:roomState?.nextQuestion||null,nextQuestion:upcoming,seenQuestions:newSeen,flipped:false,perspectiveFlipped:false});
            };

            // Deck exhausted together -- show a synced prompt so both players
            // advance (or wrap up) in unison
            const roomExhausted = roomStatus==="connected" && !roomState?.currentQuestion;
            if(roomExhausted){
              const idx=STAGE_ORDER.indexOf(relationshipType);
              const nextId=STAGE_ORDER[idx+1];
              const nextStage=RELATIONSHIP_TYPES.find(r=>r.id===nextId);
              const replayRoom=async()=>{
                const pool2=buildPool(activeCats,relationshipType,spicyLevel);
                const f=pickNextUnseen(pool2,new Set(),"");
                const s2=pickNextUnseen(pool2,new Set(),f?.question||"");
                await syncAction({seenQuestions:[],currentQuestion:f||null,nextQuestion:s2||null,flipped:false,perspectiveFlipped:false});
              };
              const headingC=(t)=><p style={{...GF_TITLE,fontSize:25,color:"#3C2010",lineHeight:1.3,marginBottom:12}}>{t}</p>;
              const bodyC=(t)=><p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#A08868",lineHeight:1.7,marginBottom:22,maxWidth:264}}>{t}</p>;
              const primaryStyleC={width:"100%",maxWidth:280,padding:"13px 24px",marginBottom:10};
              const connexionBtnC=<TextureButton variant="ghost" style={primaryStyleC} onClick={openConnexion}>Explore other Connexion Studio apps</TextureButton>;
              const resetLinkC=(label,fn)=><button onClick={fn} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#B8A888",letterSpacing:"0.04em",textDecoration:"underline",textUnderlineOffset:"3px",marginTop:6}}>{label}</button>;
              let inner;
              if(!relationshipType){
                inner=<>{headingC("You've completed the deck!")}{bodyC("You've worked your way through every question in this deck. The conversations and connections you've built are what matter most.")}{connexionBtnC}{resetLinkC("Reset questions", replayRoom)}</>;
              } else if(relationshipType==="friends"){
                inner=<>{headingC("You've explored it all!")}{bodyC("Ready to go deeper? Explore the couple decks and discover new conversations together.")}<TextureButton style={primaryStyleC} onClick={()=>changeRelationship("just_together")}>Explore couple questions</TextureButton>{connexionBtnC}{resetLinkC("Reset questions", replayRoom)}</>;
              } else if(!nextStage){
                inner=<>{headingC("You've shared it all… for now!")}{bodyC("You've explored every Long-term connection question, hundreds of conversations worth having. New questions are on the way. Until then, revisit your favourites and see what feels different.")}<TextureButton style={primaryStyleC} onClick={replayRoom}>Replay Long-term connection</TextureButton>{connexionBtnC}{resetLinkC("Reset all questions", replayRoom)}</>;
              } else {
                inner=<>{headingC("Ready to go deeper?")}{bodyC(`You've explored every ${currentStage?.label} question. Continue your journey with ${nextStage.label}.`)}<TextureButton style={primaryStyleC} onClick={()=>changeRelationship(nextId)}>Move to {nextStage.label}</TextureButton>{connexionBtnC}{resetLinkC("Reset questions", replayRoom)}</>;
              }
              return(
                <div style={{position:"relative",width:"100%",maxWidth:340,minHeight:"55vh",maxHeight:460,flexShrink:0,marginBottom:8,background:"#F5EDE0",border:"1.5px solid #E8DDD0",borderRadius:20,padding:"28px 24px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",overflowY:"auto",boxShadow:"-4px 12px 40px rgba(54,28,8,0.16)"}}>
                  <div style={{position:"absolute",inset:10,border:"1px solid rgba(180,160,140,0.25)",borderRadius:12,pointerEvents:"none"}}/>
                  {inner}
                </div>
              );
            }

            return(
              <>
                <div style={{position:"relative",width:"100%",maxWidth:340,height:"55vh",maxHeight:460,flexShrink:0,marginBottom:8}}
                  onMouseDown={e=>{if(!syncedFlipped)return;dragStartX.current=e.clientX;hasDragged.current=false;setIsDragging(true);}}
                  onMouseMove={e=>{if(!isDragging||dragStartX.current===null)return;const x=e.clientX-dragStartX.current;if(Math.abs(x)>4)hasDragged.current=true;setDragX(x);}}
                  onMouseUp={()=>{if(!isDragging)return;setIsDragging(false);if(Math.abs(dragX)>80){setGoneDir(dragX>0?1:-1);setGone(true);setTimeout(async()=>{await advanceRoom();setGone(false);setDragX(0);hasDragged.current=false;},300);}else{setDragX(0);setTimeout(()=>{hasDragged.current=false;},50);}dragStartX.current=null;}}
                  onMouseLeave={()=>{if(!isDragging)return;setIsDragging(false);setDragX(0);dragStartX.current=null;}}
                  onTouchStart={e=>{if(!syncedFlipped)return;dragStartX.current=e.touches[0].clientX;hasDragged.current=false;setIsDragging(true);}}
                  onTouchMove={e=>{if(!isDragging||dragStartX.current===null)return;const x=e.touches[0].clientX-dragStartX.current;if(Math.abs(x)>4)hasDragged.current=true;setDragX(x);}}
                  onTouchEnd={()=>{if(!isDragging)return;setIsDragging(false);if(Math.abs(dragX)>80){setGoneDir(dragX>0?1:-1);setGone(true);setTimeout(async()=>{await advanceRoom();setGone(false);setDragX(0);hasDragged.current=false;},300);}else{setDragX(0);setTimeout(()=>{hasDragged.current=false;},50);}dragStartX.current=null;}}
                >
                  <div style={{position:"absolute",inset:0,zIndex:2,
                    transform:gone?`translateX(${goneDir*110}vw) rotate(${goneDir*18}deg)`:`translateX(${dragX}px) rotate(${dragX*0.025}deg)`,
                    transition:isDragging?"none":gone?"transform 0.28s ease-in":"transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
                    touchAction:"pan-y",
                  }}>
                    <div style={{position:"absolute",inset:0,opacity:syncedFlipped?0:1,transform:syncedFlipped?"scale(0.94)":"scale(1)",transition:isDragging?"none":"opacity 0.22s ease, transform 0.22s ease",pointerEvents:syncedFlipped?"none":"auto",cursor:"pointer"}}
                      onClick={async()=>{if(!hasDragged.current){audio.resume();audio.flip();await syncAction({flipped:true});}}}>
                      <CardBack/>
                    </div>
                    <div style={{position:"absolute",inset:0,opacity:syncedFlipped?1:0,transform:syncedFlipped?"scale(1)":"scale(0.94)",
                      transition:isDragging?"none":"opacity 0.22s ease 0.08s, transform 0.22s ease 0.08s",
                      background:syncedBg,border:`1.5px solid ${syncedBorder}`,borderRadius:20,padding:"24px 22px",
                      display:"flex",flexDirection:"column",justifyContent:"space-between",
                      boxShadow:"-4px 12px 40px rgba(54,28,8,0.16), -2px 4px 12px rgba(54,28,8,0.10)",
                      pointerEvents:syncedFlipped?"auto":"none",cursor:syncedFlipped?"grab":"default"}}>
                      <div style={{position:"absolute",inset:10,border:"1px solid rgba(180,160,140,0.25)",borderRadius:12,pointerEvents:"none"}}/>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:5,height:5,borderRadius:"50%",background:"#3C2410",flexShrink:0}}/>
                          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,letterSpacing:"0.18em",textTransform:"uppercase",color:"#3C2410",opacity:0.6}}>{syncedQ?.category}</p>
                        </div>
                        <SpicyBadge level={syncedQ?.spicy}/>
                      </div>
                      <p style={{...GF_TITLE,fontSize:20,lineHeight:1.6,color:"#2C1808",flex:1,display:"flex",alignItems:"center",paddingTop:10,textAlign:"left"}}>
                        {syncedDisplay}
                      </p>
                      {syncedQ?.canFlip&&(
                        <div style={{display:"flex",justifyContent:"flex-end",paddingTop:8}}>
                          <button onClick={async(e)=>{e.stopPropagation();await syncAction({perspectiveFlipped:!syncedPerspective});}} style={{background:syncedPerspective?"#3C2410":"transparent",border:"1px solid #C4A882",borderRadius:100,padding:"4px 14px",cursor:"pointer",transition:"all 0.2s"}}>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:syncedPerspective?"#F5EDD9":"#8B6445",fontWeight:500}}>Flip</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{flexShrink:0,textAlign:"center",marginTop:12}}>
                  <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#A08868",letterSpacing:"0.03em",minHeight:16}}>
                    {!syncedFlipped?"Tap to reveal":Math.abs(dragX)>40?"Let go to move on":"Swipe when you're both done"}
                  </p>
                  {(()=>{
                    const roomPool=buildPool(activeCats,relationshipType,spicyLevel);
                    const seenSet=new Set(roomState?.seenQuestions||[]);
                    const unseen=roomPool.filter(q=>!seenSet.has(q.question)).length;
                    const played=(roomState?.seenQuestions||[]).length;
                    return(
                      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#C8B8A0",letterSpacing:"0.04em",marginTop:4}}>
                        {unseen} unseen · {played} played
                      </p>
                    );
                  })()}
                </div>
              </>
            );
          })()}
        </div>
      )}

    </div>
  );
}
