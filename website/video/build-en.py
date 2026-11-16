#!/usr/bin/env python3
"""Builds the English launch video: animated intro + REAL GUI recording (time-lapsed to fit narration) + outro."""
import json,subprocess,textwrap,os
V=os.path.dirname(os.path.abspath(__file__));os.chdir(V)
FONT='/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
dur=lambda f:float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
N={i:dur(f'audio-en/n{i}.mp3') for i in range(1,15)}
text={3:"Let's run a real case, live, in the real interface. This is the fleet: thirty-seven agents, ready to work.",
4:"We import a ready-made workflow from a JSON file: from customer feedback, to next sprint.",
5:"It chains four agents. We paste seven real pieces of beta feedback, and press run.",
6:"First, the feedback synthesizer groups the comments into themes, and ranks them by severity.",
7:"Then the sprint prioritizer reads the actual codebase, scores every idea, and cuts what doesn't fit.",
8:"The third agent designs experiments for the top items. The fourth turns everything into a day by day schedule.",
9:"Under four minutes, and ninety-three cents later, the whole chain is done.",
10:"Every step is saved. The first agent found three themes, led by failure visibility and recovery.",
11:"The second turned them into a backlog with one clear outcome: resume a failed workflow from the step that broke.",
12:"The third wrote the experiment designs, and was honest enough to say a true A/B test isn't possible with seven comments.",
13:"And the fourth produced a six day schedule, with the biggest risk called out."}
# narration line -> raw GUI range (seconds in raw.webm, from gui/marks.json events)
seg={3:(0.4,8.2),4:(8.2,14.0),5:(14.0,32.1),6:(32.1,58.05),7:(58.05,147.12),8:(147.12,265.5),9:(265.5,271.5),
10:(271.5,284.0),11:(284.0,296.49),12:(296.49,308.6),13:(309.0,321.0)}
PAD=0.45
intro=sum(json.load(open('durations-en.json'))[:2])
parts=[];t=intro;audio=[(1,0.2),(2,json.load(open('durations-en.json'))[0]+0.2)]
for k in sorted(seg):
    a,b=seg[k];L=N[k]+PAD;sp=(b-a)/L
    parts.append((k,a,b,L,sp));audio.append((k,t+0.2));t+=L
gui_len=t-intro;out_start=t
audio.append((14,out_start+0.2))
print('GUI length %.1fs, outro starts %.1fs, total %.1fs'%(gui_len,out_start,out_start+json.load(open('durations-en.json'))[2]))
os.makedirs('en/cap',exist_ok=True)
os.makedirs('en/seg',exist_ok=True)
segfiles=[]
for idx,(k,a,b,L,sp) in enumerate(parts):
    cap='\n'.join(textwrap.wrap(text[k],74));open(f'en/cap/{k}.txt','w').write(cap)
    vf=(f"setpts=(PTS-STARTPTS)/{sp:.4f},fps=30,scale=1520:855,"
        f"pad=1920:1080:200:70:color=0xf6f7fa,drawbox=x=200:y=70:w=1520:h=855:color=0xdde1ea:t=2,"
        f"drawtext=fontfile={FONT}:textfile=en/cap/{k}.txt:fontsize=36:fontcolor=0x161a24:x=(w-text_w)/2:y=958:line_spacing=8")
    if sp>=2: vf+=f",drawtext=fontfile={FONT}:text='TIME-LAPSE  x{sp:.0f}':fontsize=34:fontcolor=white:box=1:boxcolor=0xc4620d@0.95:boxborderw=14:x=1720-text_w:y=12"
    if idx==0: vf+=",fade=t=in:st=0:d=0.4"
    if idx==len(parts)-1: vf+=f",fade=t=out:st={L-0.4:.2f}:d=0.4"
    out=f'en/seg/{k}.mp4'
    subprocess.check_call(['ffmpeg','-y','-v','error','-ss',str(a),'-t',str(b-a),'-i','gui/raw.webm','-vf',vf,'-t',f'{L:.3f}','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','30',out])
    segfiles.append(out);print('segment',k,'ok',flush=True)
open('en/seglist.txt','w').write(''.join(f"file 'seg/{k}.mp4'\n" for k in sorted(seg)))
subprocess.check_call(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i','en/seglist.txt','-c','copy','en/gui.mp4'])
# audio track
ins=[];af=[]
for j,(k,s) in enumerate(audio):
    ins+=['-i',f'audio-en/n{k}.mp3'];ms=int(s*1000);af.append(f'[{j}:a]adelay={ms}|{ms}[a{j}]')
total=out_start+json.load(open('durations-en.json'))[2]
af.append(''.join(f'[a{j}]' for j in range(len(audio)))+f'amix=inputs={len(audio)}:normalize=0:duration=longest,apad=whole_dur={total:.2f},atrim=0:{total:.2f}[out]')
subprocess.check_call(['ffmpeg','-y','-v','error']+ins+['-filter_complex',';'.join(af),'-map','[out]','-ar','44100','en/narration.wav'])
# join video parts + audio
open('en/list.txt','w').write("file 'intro.mp4'\nfile 'gui.mp4'\nfile 'outro.mp4'\n")
subprocess.check_call(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i','en/list.txt','-i','en/narration.wav','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest','control-center-launch-en.mp4'])
print(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size','-of','default=nw=1','control-center-launch-en.mp4']).decode())
