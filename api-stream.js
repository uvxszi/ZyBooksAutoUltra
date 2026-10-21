export async function requestCompletion(card,messages,schema,signal,update){
  const format=card.format==='json_schema'?{type:'json_schema',json_schema:{name:'manual_response',strict:true,schema}}:{type:'json_object'};
  const body={model:card.apiModel,messages,temperature:card.temperature,...(card.limitOutput===true?{max_tokens:card.maxTokens}:{}),response_format:format,stream:true};
  const init={method:'POST',headers:{'Content-Type':'application/json',...(card.key?{Authorization:'Bearer '+card.key}:{})},signal,credentials:'omit',redirect:'error'};
  let response=await fetch(card.endpoint,{...init,body:JSON.stringify(body)});
  if(!response.ok){
    const error=(await response.text()).slice(0,10000);
    if([400,422].includes(response.status)&&/stream/i.test(error)){
      update({phase:'Streaming unavailable — waiting for response'});delete body.stream;
      response=await fetch(card.endpoint,{...init,body:JSON.stringify(body)});
    }
  }
  if(!response.ok)throw Error(`Server returned HTTP ${response.status}. Check the endpoint, key, and model settings.`);
  if(!response.headers.get('content-type')?.includes('text/event-stream')){
    const text=await response.text();if(text.length>16777216)throw Error('Server response is too large.');
    const r=JSON.parse(text);if(r.choices?.[0]?.finish_reason==='length')throw Error('Response was cut off. Increase the output token limit.');
    return {raw:r.choices?.[0]?.message?.content,usage:r.usage};
  }
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',raw='',usage,finish='',done=false;
  function event(block){
    const data=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if(!data)return;if(data==='[DONE]'){done=true;return;}
    const chunk=JSON.parse(data);if(chunk.error)throw Error('The API reported a generation error.');
    raw+=chunk.choices?.[0]?.delta?.content||'';if(raw.length>16777216)throw Error('Model response is too large.');
    usage=chunk.usage||usage;finish=chunk.choices?.[0]?.finish_reason||finish;
    update({raw,phase:'Generating',tokens:usage?.completion_tokens});
  }
  try{
    while(!done){const r=await reader.read();buffer+=decoder.decode(r.value,{stream:!r.done});if(buffer.length>16777216)throw Error('Streaming event is too large.');
      let match;while((match=/\r?\n\r?\n/.exec(buffer))){event(buffer.slice(0,match.index));buffer=buffer.slice(match.index+match[0].length);if(done)break;}
      if(r.done){if(buffer.trim())event(buffer);break;}
    }
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  if(finish==='length')throw Error('Response was cut off. Increase the output token limit.');
  if(!raw)throw Error('The API returned no answer text.');return {raw,usage};
}
