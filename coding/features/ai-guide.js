import { AI_ENDPOINT } from '../config/ai.js';
export function createAIGuide({container,getTarget,getLanguage,onOpen}) {
  const el = (tag,cls,text='') => {const n=document.createElement(tag); n.className=cls;n.textContent=text;return n;};
  const ms=()=>getLanguage()==='ms';
  const button=el('button','ai-launch','✳ AI');button.type='button';button.id='ai-launch';button.setAttribute('aria-controls','ai-panel');button.setAttribute('aria-expanded','false');
  const panel=el('section','ai-panel');panel.id='ai-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','ai-title');
  const header=el('header','ai-heading'),heading=el('h2','','Ask the island'),dismiss=el('button','quiet','×');heading.id='ai-title';dismiss.type='button';
  const subtitle=el('p','ai-subtitle'),notice=el('p','ai-notice'),messages=el('div','ai-messages');messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');
  const suggestions=el('div','ai-suggestions');
  const form=el('form','ai-form'),label=el('label','sr-only'),input=el('textarea'); input.id='ai-question';input.rows=2;input.maxLength=800;input.required=true;label.htmlFor=input.id;
  const send=el('button','primary','Send');send.type='submit';const status=el('p','ai-status');status.setAttribute('role','status');
  form.append(label,input,send);header.append(heading,dismiss);panel.append(header,subtitle,notice,messages,suggestions,form,status);container.append(button,panel);
  let history=[],controller=null,landmark=null;
  function close(focus=true){panel.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus();}
  function reset(){controller?.abort();controller=null;history=[];messages.replaceChildren();input.value='';status.textContent='';send.disabled=false;close(false);}
  function sync(){
    const target=getTarget();button.disabled=!target;button.hidden=!target;
    if(landmark!==target?.id){reset();landmark=target?.id;}
    button.setAttribute('aria-label',ms()?'Tanya pemandu AI':'Ask the AI guide');dismiss.setAttribute('aria-label',ms()?'Tutup AI':'Close AI guide');
    heading.textContent=ms()?'Tanya tentang Labuan':'Ask the island';subtitle.textContent=target?.fullName||'';
    notice.textContent=ms()?'Pemandu AI · Jawapan mungkin tersilap. Soalan dihantar ke OpenAI. Elakkan maklumat peribadi.':'AI guide · Answers can be mistaken. Questions are sent to OpenAI. Avoid personal details.';
    label.textContent=ms()?'Soalan tentang lokasi ini':'Question about this landmark';input.placeholder=ms()?'Apakah yang anda ingin tahu?':'What would you like to know?';send.textContent=ms()?'Hantar':'Send';
    suggestions.replaceChildren();
    for(const q of (ms()?['Mengapa tempat ini penting?','Apakah kisah di sebalik tempat ini?']:['Why does this place matter?','What else can I discover nearby?'])){const b=el('button','',q);b.type='button';b.addEventListener('click',()=>{input.value=q;form.requestSubmit();});suggestions.append(b);}
  }
  button.addEventListener('click',()=>{if(!panel.hidden){close();return;}onOpen();sync();panel.hidden=false;button.setAttribute('aria-expanded','true');input.focus();});dismiss.addEventListener('click',()=>close());
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
  function message(role,text){const block=el('div',`ai-message ${role}`,text);messages.append(block);block.scrollIntoView({block:'nearest'});return block;}
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(controller||!getTarget())return;const question=input.value.trim();if(!question)return;
    const endpoint=AI_ENDPOINT || new URL('./api/chat.php',location.href).href;
    if(!AI_ENDPOINT && location.hostname.endsWith('.github.io')){status.textContent=ms()?'AI belum disambungkan. Tetapkan alamat pelayan AI untuk laman ini.':'The AI guide is not connected yet. This live site needs its AI server address configured.';return;}
    const request=new AbortController();controller=request;send.disabled=true;input.value='';message('user',question);status.textContent=ms()?'Sedang mencari jawapan…':'Finding an answer…';
    const timer=setTimeout(()=>request.abort(),60000);
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({landmark:getTarget().id,language:getLanguage(),question,history:history.slice(-6)}),signal:request.signal,credentials:'omit'});
      if(!response.headers.get('content-type')?.includes('application/json'))throw new Error(ms()?'Pelayan AI belum tersedia untuk laman ini.':'The AI server is not available for this website yet.');
      const data=await response.json();if(!response.ok)throw new Error(data.code==='not_configured'?(ms()?'AI belum disambungkan oleh pemilik projek.':'The AI guide has not been connected by the project owner yet.'):data.code==='rate_limit'?'Please wait before asking another question.':'The AI guide is unavailable. Please try again later.');
      const block=message('assistant','');
      for(const part of data.parts||[]){
        const chars=Array.from(part.text||'');let cursor=0;
        for(const citation of [...(part.citations||[])].sort((a,b)=>a.start-b.start)){
          if(citation.start<cursor||citation.end>chars.length||!/^https?:\/\//i.test(citation.url))continue;
          block.append(document.createTextNode(chars.slice(cursor,citation.start).join('')));
          const a=el('a','ai-citation',citation.title||'Source');a.href=citation.url;a.target='_blank';a.rel='noopener noreferrer';block.append(a);cursor=citation.end;
        }
        block.append(document.createTextNode(chars.slice(cursor).join('')+'\n'));
      }
      if(!block.textContent.trim())throw new Error('No answer was returned. Please try again.');
      history.push({role:'user',content:question},{role:'assistant',content:(data.parts||[]).map(p=>p.text).join('\n')});history=history.slice(-6);status.textContent='';block.scrollIntoView({block:'nearest'});
    }catch(error){if(controller===request){status.textContent=error.name==='AbortError'?'The request timed out. Please try again.':error instanceof TypeError?'Could not reach the AI guide. Check your connection and try again.':error.message;input.value=question;}}
    finally{clearTimeout(timer);if(controller===request){controller=null;send.disabled=false;}}
  });
  return {sync,close,reset};
}
