import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IpfsMedia } from './IpfsMedia';
import { RetroScanImage } from './RetroScanImage';
import type { RetroScan } from '@/lib/retroScans';
import { useCardTilt } from '@/hooks/useCardTilt';
import { Move3d, Search, Pencil, Eraser, WandSparkles, Type, Undo2, Check, X } from 'lucide-react';

export type ViewMode = 'tilt' | 'lens' | 'draw';
export const DRAW_COLORS = [{ name: 'Black', value: '#000000' }, { name: 'Yellow', value: 'hsl(45, 97%, 54%)' }, { name: 'White', value: '#ffffff' }, { name: 'Red', value: '#ef4444' }, { name: 'Blue', value: '#3b82f6' }];
export const HANDWRITING_STYLES = [
  { id: 'cursive', name: 'Cursive', font: 'Caveat' }, { id: 'neat', name: 'Neat print', font: 'Patrick Hand' },
  { id: 'pencil', name: 'Pencil', font: 'Kalam' }, { id: 'marker', name: 'Marker', font: 'Permanent Marker' },
  { id: 'childlike', name: 'Childlike', font: 'Schoolbell' }, { id: 'scrawl', name: 'Messy scrawl', font: 'Reenie Beanie' },
] as const;
type Point = { x: number; y: number };
type StrokeAction = { kind: 'stroke'; points: Point[]; color: string };
type TextAction = { kind: 'text'; text: string; x: number; y: number; color: string; font: string; size: number };
type CanvasAction = StrokeAction | TextAction;
export interface HandwritingCanvasHandle {
  setColor: (color: string) => void; clear: () => void; undo: () => void;
  placeText: (text: string, font: string, size: number, color: string, onPlaced?: () => void) => void;
}
const ZOOM = 4, LENS_SIZE = 220;

function DrawCanvas({ canvasRegister, active, onActivate }: { canvasRegister?: (canvas: HTMLCanvasElement | null, handle?: HandwritingCanvasHandle) => void; active?: boolean; onActivate?: (handle: HandwritingCanvasHandle) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null), actionsRef = useRef<CanvasAction[]>([]), currentStroke = useRef<StrokeAction | null>(null), colorRef = useRef(DRAW_COLORS[0].value), placementRef = useRef<((point: Point) => void) | null>(null);
  const drawing = useRef(false); const [placing, setPlacing] = useState(false);
  const redraw = useCallback(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    actionsRef.current.forEach(action => {
      if (action.kind === 'stroke') { if (action.points.length < 2) return; ctx.strokeStyle = action.color; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(action.points[0].x, action.points[0].y); action.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); }
      else { ctx.fillStyle = action.color; ctx.font = `${action.size}px "${action.font}"`; ctx.textBaseline = 'middle'; ctx.fillText(action.text, action.x, action.y); }
    });
  }, []);
  const getPos = useCallback((e: React.PointerEvent) => { const c = canvasRef.current; if (!c) return { x: 0, y: 0 }; const r = c.getBoundingClientRect(); return { x: (e.clientX-r.left)*c.width/r.width, y: (e.clientY-r.top)*c.height/r.height }; }, []);
  const handleRef = useRef<HandwritingCanvasHandle>();
  if (!handleRef.current) handleRef.current = {
    setColor: c => { colorRef.current = c; }, clear: () => { actionsRef.current = []; redraw(); }, undo: () => { actionsRef.current.pop(); redraw(); },
    placeText: (text,font,size,color,onPlaced) => { placementRef.current=point=>{ actionsRef.current.push({kind:'text',text,font,size,color,...point}); placementRef.current=null; setPlacing(false); redraw(); onPlaced?.(); }; setPlacing(true); },
  };
  useEffect(() => { const c=canvasRef.current,h=handleRef.current; if(!c||!h)return; canvasRegister?.(c,h); return()=>canvasRegister?.(null); }, [canvasRegister]);
  useEffect(() => { const c=canvasRef.current,p=c?.parentElement;if(!c||!p)return;const resize=()=>{c.width=p.clientWidth;c.height=p.clientHeight;redraw();};const ro=new ResizeObserver(resize);ro.observe(p);resize();return()=>ro.disconnect();},[redraw]);
  const down=useCallback((e:React.PointerEvent)=>{const h=handleRef.current;if(h)onActivate?.(h);const p=getPos(e);if(placementRef.current){placementRef.current(p);return;}drawing.current=true;currentStroke.current={kind:'stroke',points:[p],color:colorRef.current};canvasRef.current?.setPointerCapture(e.pointerId);},[getPos,onActivate]);
  const move=useCallback((e:React.PointerEvent)=>{if(!drawing.current||!currentStroke.current)return;currentStroke.current.points.push(getPos(e));redraw();const s=currentStroke.current,ctx=canvasRef.current?.getContext('2d');if(!ctx||s.points.length<2)return;const a=s.points.at(-2),b=s.points.at(-1);if(!a||!b)return;ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();},[getPos,redraw]);
  const up=useCallback(()=>{if(currentStroke.current&&currentStroke.current.points.length>1)actionsRef.current.push(currentStroke.current);drawing.current=false;currentStroke.current=null;redraw();},[redraw]);
  return <canvas ref={canvasRef} className="absolute inset-0 z-40 rounded-lg" style={{cursor:placing?'text':active?'crosshair':'default',touchAction:'none',pointerEvents:active?'auto':'none'}} onPointerDown={active?down:undefined} onPointerMove={active?move:undefined} onPointerUp={active?up:undefined} onPointerLeave={active?up:undefined}/>;
}

export function ImageWithModes({url,alt,isLandscape,className,mode,canvasRegister,retroScan,rotated,onCanvasActivate}:{url:string;alt:string;isLandscape:boolean;className?:string;mode:ViewMode;canvasRegister?:(canvas:HTMLCanvasElement|null,handle?:HandwritingCanvasHandle)=>void;retroScan?:RetroScan|null;rotated?:boolean;onCanvasActivate?:(handle:HandwritingCanvasHandle)=>void}) {
  const isRotated=rotated??isLandscape,[hover,setHover]=useState(false),[pos,setPos]=useState({x:0,y:0}),[everDrawn,setEverDrawn]=useState(false),containerRef=useRef<HTMLDivElement>(null),[displayedUrl,setDisplayedUrl]=useState<string|null>(null),sourceKey=retroScan?.src??url;
  useEffect(()=>setDisplayedUrl(null),[sourceKey]);useEffect(()=>{const el=containerRef.current;if(!el)return;const sync=()=>{const img=el.querySelector('img');if(img?.complete&&img.naturalWidth>0)setDisplayedUrl(img.currentSrc||img.src);};sync();const err=()=>setDisplayedUrl(null);el.addEventListener('load',sync,true);el.addEventListener('error',err,true);return()=>{el.removeEventListener('load',sync,true);el.removeEventListener('error',err,true);};},[sourceKey]);
  const tiltActive=mode==='tilt',{ref:tiltRef,glareRef,onMouseMove:tiltMove,onMouseLeave:tiltLeave}=useCardTilt({disabled:!tiltActive,landscape:isLandscape});useEffect(()=>{if(mode==='draw')setEverDrawn(true);},[mode]);
  const mouseMove=(e:React.MouseEvent)=>{if(mode==='lens'){const r=containerRef.current?.getBoundingClientRect();if(r)setPos({x:Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)),y:Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100))});}if(tiltActive)tiltMove(e as React.MouseEvent<HTMLDivElement>);};const bgX=isRotated?pos.y:pos.x,bgY=isRotated?100-pos.x:pos.y;
  return <div ref={containerRef} className={`relative ${isLandscape?'aspect-[4/3]':'aspect-[3/4]'} bg-muted/30 rounded-lg`} onMouseEnter={()=>mode==='lens'&&setHover(true)} onMouseLeave={()=>{setHover(false);if(tiltActive)tiltLeave();}} onMouseMove={mouseMove} style={{cursor:mode==='lens'&&hover?'crosshair':'default',perspective:tiltActive?'1200px':undefined}}><div ref={tiltRef} className="w-full h-full overflow-hidden rounded-lg flex items-center justify-center relative" style={{transformStyle:tiltActive?'preserve-3d':undefined,willChange:tiltActive?'transform':undefined}}>{retroScan?<RetroScanImage scan={retroScan} alt={alt} className={`w-full h-full ${className||''}`}/>:<IpfsMedia url={url} alt={alt} className={`w-full h-full ${className||''}`} context="detail" showSkeleton/>}<div ref={glareRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-lg transition-opacity duration-200" style={{opacity:0,mixBlendMode:'overlay'}}/></div>{(mode==='draw'||everDrawn)&&<DrawCanvas canvasRegister={canvasRegister} active={mode==='draw'} onActivate={onCanvasActivate}/>} {mode==='lens'&&hover&&displayedUrl&&!displayedUrl.includes('placeholder')&&<div className="absolute pointer-events-none rounded-full border-2 border-cheese/50 shadow-lg z-50 overflow-hidden" style={{width:LENS_SIZE,height:LENS_SIZE,left:`calc(${pos.x}% - ${LENS_SIZE/2}px)`,top:`calc(${pos.y}% - ${LENS_SIZE/2}px)`}}><div style={{width:'100%',height:'100%',backgroundImage:`url(${displayedUrl})`,backgroundSize:`${ZOOM*100}%`,backgroundPosition:`${bgX}% ${bgY}%`,backgroundRepeat:'no-repeat',...(isRotated?{transform:'rotate(90deg) scale(1.33)'}:{})}}/></div>}</div>;
}

export function ArtworkModeControls({mode,onModeChange,color,onColorChange,onClear,activeCanvas,subject='card'}:{mode:ViewMode;onModeChange:(m:ViewMode)=>void;color:string;onColorChange:(c:string)=>void;onClear:()=>void;activeCanvas?:HandwritingCanvasHandle|null;subject?:string}) {
  const [handwriting,setHandwriting]=useState(false),[editor,setEditor]=useState(false),[text,setText]=useState(''),[style,setStyle]=useState('cursive'),[size,setSize]=useState(38),[message,setMessage]=useState('');
  useEffect(()=>{if(mode!=='draw'){setHandwriting(false);setEditor(false);setMessage('');}},[mode]);const selected=HANDWRITING_STYLES.find(s=>s.id===style)??HANDWRITING_STYLES[0],cls=(m:ViewMode)=>`h-7 w-7 rounded-md ${mode===m?'bg-cheese/20 text-cheese':'text-muted-foreground'}`;
  const confirm=()=>{const value=text.trim();if(!value||!activeCanvas)return;activeCanvas.placeText(value,selected.font,size,color,()=>{setEditor(false);setText('');setMessage('');});setMessage(`Click the ${subject} where the text should begin.`);};
  return <div className="flex flex-col items-center gap-1.5 mt-1"><div className="flex gap-1.5"><Button variant="ghost" size="icon" className={cls('tilt')} onClick={()=>onModeChange('tilt')} title="3D tilt (default)" aria-label="3D tilt"><Move3d className="h-4 w-4"/></Button><Button variant="ghost" size="icon" className={cls('lens')} onClick={()=>onModeChange('lens')} title="Magnifier" aria-label="Magnifier"><Search className="h-4 w-4"/></Button><Button variant="ghost" size="icon" className={cls('draw')} onClick={()=>onModeChange('draw')} title={`Draw on ${subject}`} aria-label={`Draw on ${subject}`}><Pencil className="h-4 w-4"/></Button>{mode==='draw'&&<Button variant="ghost" size="icon" className={`h-7 w-7 rounded-md ${handwriting?'bg-cheese/20 text-cheese':'text-muted-foreground'}`} onClick={()=>{setHandwriting(v=>!v);setEditor(false);setMessage('');}} title="Handwriting replacement" aria-label="Handwriting replacement" aria-pressed={handwriting}><WandSparkles className="h-4 w-4"/></Button>}</div>
  {mode==='draw'&&<div className="flex flex-wrap justify-center items-center gap-1.5 bg-background/80 backdrop-blur rounded-lg px-2 py-1">{DRAW_COLORS.map(c=><Button key={c.name} variant="ghost" size="icon" title={c.name} aria-label={c.name} className={`w-5 h-5 rounded-full border-2 ${color===c.value?'scale-125 border-cheese':'border-muted-foreground/40'}`} style={{background:c.value}} onClick={()=>onColorChange(c.value)}/>)}<Button variant="ghost" size="icon" title="Undo" aria-label="Undo drawing" className="w-7 h-7" onClick={()=>activeCanvas?.undo()}><Undo2 className="h-3.5 w-3.5"/></Button><Button variant="ghost" size="sm" title="Clear" className="px-2 py-0.5 rounded-md bg-cheese text-cheese-foreground text-xs font-semibold hover:bg-cheese/80 flex items-center gap-1" onClick={onClear}><Eraser className="h-3 w-3"/> Clear</Button></div>}
  {mode==='draw'&&handwriting&&<div className="w-full max-w-xl rounded-md border border-border bg-background/90 p-2 space-y-2"><div className="flex flex-wrap justify-center gap-2"><Button size="sm" variant="secondary" onClick={()=>{setEditor(true);setText('');setMessage('');}}><Type className="h-3.5 w-3.5 mr-1"/>Type text</Button></div>{editor&&<div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px_90px_auto] gap-2 items-center"><Input value={text} onChange={e=>setText(e.target.value)} placeholder="Name or word" aria-label="Handwriting text" autoFocus/><Select value={style} onValueChange={setStyle}><SelectTrigger aria-label="Handwriting style"><SelectValue/></SelectTrigger><SelectContent>{HANDWRITING_STYLES.map(s=><SelectItem key={s.id} value={s.id}><span style={{fontFamily:s.font}}>{s.name}</span></SelectItem>)}</SelectContent></Select><label className="flex items-center gap-1 text-xs"><span>Size</span><Input type="number" min={18} max={96} value={size} onChange={e=>setSize(Math.max(18,Math.min(96,Number(e.target.value)||38)))} aria-label="Handwriting size" className="h-9"/></label><div className="flex gap-1"><Button size="icon" className="h-9 w-9" onClick={confirm} disabled={!text.trim()} title="Place text" aria-label="Place text"><Check className="h-4 w-4"/></Button><Button size="icon" variant="ghost" className="h-9 w-9" onClick={()=>{setEditor(false);setMessage('');}} title="Cancel" aria-label="Cancel handwriting"><X className="h-4 w-4"/></Button></div></div>}{message&&<p className="text-xs text-muted-foreground text-center" role="status">{message}</p>}</div>}</div>;
}
