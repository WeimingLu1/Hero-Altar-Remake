import { originalTables, originalTasks, originalText, type OriginalRecord } from "./original-data";

export type SceneEventCall = { type:number; id?:number; extra?:number };
export type SceneActorState = {
  inventory: Record<string,number>; gold:number; hp:number; maxHp:number; fp:number; maxFp:number;
  food:number; water:number; exp:number; potential:number; morals:number; tanId:number;
  teacherId:number;classId:number;gender:number;face:number;mp:number;maxMp:number;age:number;
  baseBon:number;baseInt:number;baseAgi:number;baseStr:number;bon:number;int:number;agi:number;str:number;luck:number;
  skills:Record<string,{level:number;points:number}>;
  weaponId:number;armorIds:number[];skillUse:number[];fpPlus:number;
};
export type SceneResolution = { lines:string[]; gain?:{kind:1|2|3;id:number;amount:number}; transfer?:{mapId:number;x:number;y:number}; tag:string };

const asRecord=(value:unknown)=>(value||{}) as Record<string,unknown>;
const asLines=(value:unknown)=>Array.isArray(value)?value.map(String):value==null?[]:[String(value)];
const nameAt=(table:Array<OriginalRecord|null>,id:number)=>String(table[id]?.name||`编号 ${id}`);
const deterministic=(lines:string[],seed:number)=>lines.length?lines[Math.abs(seed)%lines.length]:"……";

export function resolveSceneEvent(call:SceneEventCall,actor:SceneActorState,seed=0):SceneResolution{
  const id=call.id||0,type=call.type;
  if(type===0){
    const enemy=originalTables.enemies[id],name=String(enemy?.name||"江湖中人");
    const special=asRecord(originalText.sp_talk_text)[String(id)];
    const pool=asLines(special ?? originalText.normal_talk);
    return {lines:[deterministic(pool,seed).replaceAll("name",name)],tag:`npc:${id}`};
  }
  if(type>=1&&type<=3){
    const table=type===1?originalTables.items:type===2?originalTables.weapons:originalTables.armors;
    const itemName=nameAt(table,id),template=String(originalText.find_item_text||"发现name。").replace("name",itemName);
    return {lines:[template],gain:{kind:type,id,amount:Math.max(1,call.extra||1)},tag:`gain:${type}:${id}`};
  }
  if(type===4)return {lines:[String(originalText.start_fish||"你抛下了鱼线。")],tag:"fish"};
  if(type===5)return {lines:[String(originalText.drink_water_text||"你喝了些水。")],tag:"drink-water"};
  if(type===6)return {lines:[String(originalText.play_what_text||"想玩些什么？")],tag:"game-hall"};
  if(type===7){const poems=(originalText.work_text as unknown[][])||[];return {lines:asLines(poems[Math.max(0,id-1)]||originalText.give_work_text),tag:`work:${id}`};}
  if(type===8)return {lines:asLines((originalText.boss_text as unknown[][])?.[id]||"杀气骤然逼近！").filter((_,i)=>i%2===1),tag:`boss:${id}`};
  if(type===9)return {lines:[String(originalText.wanted_text||"告示牌上贴着最新的通缉令。")],tag:"wanted"};
  if(type===10)return {lines:[String(originalText.suicide_ask||"你当真不想活了？")],tag:"suicide"};
  if(type===11)return {lines:[String(originalText.drink_wine_text||"你喝下一杯酒。")],tag:"drink-wine"};
  if(type===12)return {lines:["联机对战入口已切换为浏览器房间协议。"],tag:"network"};
  if(type===13){const xy=(originalTasks.tan_map_xy as unknown[][])?.[id];if(xy)return {lines:[String(originalText.tan_start||"你踏入坛中。")],transfer:{mapId:id,x:Number(xy[0]),y:Number(xy[1])},tag:`tan:${id}`};}
  if(type===14)return {lines:[String(originalText.sword_ask||"是否开始铸剑？")],tag:"forge"};
  if(type===15)return {lines:[String(originalText.new_home_ask||"山路深处似乎另有天地。")],tag:"new-home"};
  if(type===16)return {lines:[String(originalText.welcome_home||"你走进桃花源小屋。")],tag:"enter-home"};
  void actor;
  return {lines:[`未识别的原版事件类型：${type}`],tag:`unknown:${type}`};
}

export function applySceneResolution(actor:SceneActorState,resolution:SceneResolution){
  if(resolution.gain){const key=`${resolution.gain.kind}:${resolution.gain.id}`;actor.inventory[key]=(actor.inventory[key]||0)+resolution.gain.amount;}
  if(resolution.tag==="drink-water")actor.water+=50;
  if(resolution.tag==="drink-wine")actor.hp=Math.min(actor.maxHp,actor.hp+5);
  return actor;
}
