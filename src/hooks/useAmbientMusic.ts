import { useEffect, useRef, useState } from 'react';
export function useAmbientMusic() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [muted,setMuted] = useState(true);
  useEffect(()=>{const a=new Audio('/audio/cozy.mp3');a.loop=true;a.volume=0.22;audio.current=a;return()=>{a.pause();a.src='';audio.current=null;};},[]);
  const toggle = async () => {
    const a=audio.current;
    if(!a)return;
    if(!muted){a.pause();setMuted(true);return;}
    try{await a.play();setMuted(false);}catch(e){console.warn('Add public/audio/cozy.mp3 to play music',e);setMuted(true);}
  };
  return {muted,toggle};
}
