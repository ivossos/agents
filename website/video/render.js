// Renders scenes.html frame-by-frame (deterministic) and muxes the narration with ffmpeg.
const {chromium}=require('playwright');const {spawn}=require('child_process');const path=require('path');
const FPS=30,OUT=process.argv[2]||'control-center-lancamento.mp4';
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await p.goto('file://'+path.join(__dirname,'scenes.html'));await p.waitForTimeout(500);
 const total=await p.evaluate(()=>window.TOTAL),n=Math.round(total*FPS);
 const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-i',path.join(__dirname,'narration.wav'),
  '-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r',String(FPS),'-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',OUT],{stdio:['pipe','inherit','inherit']});
 for(let i=0;i<n;i++){
  await p.evaluate(t=>setT(t),i/FPS);
  const buf=await p.screenshot({type:'jpeg',quality:95});
  if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
  if(i%150===0)console.log(`frame ${i}/${n}`);
 }
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done',OUT);
})();
