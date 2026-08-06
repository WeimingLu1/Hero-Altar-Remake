import { attackEffect, type Combatant, type RandomInt } from "./combat";
import { originalTables, type OriginalRecord } from "./original-data";
import type { SceneActorState } from "./scene-event";

export type OriginalBattle={enemyId:number;enemyName:string;enemyHp:number;enemyMaxHp:number;enemyFp:number;turn:number;seed:number;log:string[];finished:"win"|"lose"|null};
type Move={text:string;hitType:number;ap:number;dp:number;pp:number;damage:number;force:number};
const n=(record:OriginalRecord,key:string,fallback=0)=>Number(record[key]??fallback);
const skillLevel=(actor:SceneActorState,id:number)=>actor.skills[String(id)]?.level||0;
const lcg=(battle:OriginalBattle):RandomInt=>(max)=>{battle.seed=(Math.imul(battle.seed>>>0,1664525)+1013904223)>>>0;return Math.floor(battle.seed/4294967296*Math.max(1,max));};

function moveFor(record:OriginalRecord,kfId:number,level:number,random:RandomInt,user:string,target:string):Move{
 const kungfu=originalTables.kungfus[kfId]||originalTables.kungfus[2]||{};
 const pool=((kungfu.atk_word as unknown[][])||[]).filter(row=>Number(row[0]||0)<=level);
 const row=pool.length?pool[random(pool.length)]:[0,"user挥拳攻向target",0,0,0,0,0,0];
 return {text:String(row[1]||"user挥拳攻向target").replaceAll("user",user).replaceAll("target",target).replaceAll("position","要害"),hitType:Number(row[2]||0),ap:Number(row[3]||0),dp:Number(row[4]||0),pp:Number(row[5]||0),damage:Number(row[6]||0),force:Number(row[7]||0)};
}
function player(actor:SceneActorState,move:Move):Combatant{
 const attackId=actor.weaponId>0?(actor.skillUse[1]||1):(actor.skillUse[0]||2);
 return {exp:actor.exp,hit:skillLevel(actor,1),eva:skillLevel(actor,1),attackKfLv:skillLevel(actor,attackId),dodgeKfLv:skillLevel(actor,9),parryKfLv:skillLevel(actor,10),agi:actor.agi,int:actor.int,str:actor.str,atk:0,pdef:0,fp:actor.fp,fpPlus:actor.fpPlus,weaponId:actor.weaponId,movable:actor.hp>0,fenshen:0,kfAp:move.ap,kfDp:move.dp,kfPp:move.pp,kfDamage:move.damage,kfForce:move.force,hitType:move.hitType};
}
function enemy(record:OriginalRecord,fp:number,move:Move):Combatant{
 const skills=(record.skill_list as number[][])||[],level=(id:number)=>skills.find(row=>row[0]===id)?.[1]||0,uses=(record.skill_use as number[])||[],attackId=n(record,"weapon_id")>0?(uses[1]||1):(uses[0]||2);
 return {exp:n(record,"exp"),hit:n(record,"base_hit"),eva:n(record,"base_eva"),attackKfLv:level(attackId),dodgeKfLv:level(uses[2]||9),parryKfLv:level(uses[3]||10),agi:n(record,"agi"),int:n(record,"int"),str:n(record,"str"),atk:n(record,"atk"),pdef:n(record,"pdef"),fp,fpPlus:n(record,"fp_plus"),weaponId:n(record,"weapon_id"),movable:true,fenshen:0,kfAp:move.ap,kfDp:move.dp,kfPp:move.pp,kfDamage:move.damage,kfForce:move.force,hitType:move.hitType};
}
function resultText(result:ReturnType<typeof attackEffect>,target:string){if(result.damage==="Miss.1")return `${target}侧身避开。`;if(result.damage==="Miss.2")return `${target}架开了这一招。`;if(result.damage==="Miss.3")return `击中的竟是一道残影。`;return result.hurt>0?`${target}受到 ${result.hurt} 点伤害。`:`招式虽中，却未伤到${target}。`;}
function enemyAttackId(record:OriginalRecord){const uses=(record.skill_use as number[])||[];return n(record,"weapon_id")>0?(uses[1]||1):(uses[0]||2);}

export function beginOriginalBattle(enemyId:number,seed=9527):OriginalBattle{const e=originalTables.enemies[enemyId]||{};return {enemyId,enemyName:String(e.name||"江湖中人"),enemyHp:n(e,"hp",n(e,"maxhp",1)),enemyMaxHp:n(e,"maxhp",1),enemyFp:n(e,"fp"),turn:0,seed,log:[`${String(e.name||"江湖中人")}抱拳道：“请赐教！”`],finished:null};}
export function battleRound(source:OriginalBattle,actor:SceneActorState){const battle=structuredClone(source);if(battle.finished)return battle;const record=originalTables.enemies[battle.enemyId]||{},random=lcg(battle),playerId=actor.weaponId>0?(actor.skillUse[1]||1):(actor.skillUse[0]||2),pm=moveFor(record,playerId,skillLevel(actor,playerId),random,"你",battle.enemyName),pc=player(actor,pm),blank:Move={text:"",hitType:0,ap:0,dp:0,pp:0,damage:0,force:0},ec=enemy(record,battle.enemyFp,blank);battle.turn++;battle.log.push(pm.text);const dealt=attackEffect(pc,ec,random);actor.fp=pc.fp;battle.enemyHp=Math.max(0,battle.enemyHp-dealt.hurt);battle.log.push(resultText(dealt,battle.enemyName));if(battle.enemyHp<=0){battle.finished="win";battle.log.push(`${battle.enemyName}收招认输。`);return battle;}const enemyId=enemyAttackId(record),enemyLevel=((record.skill_list as number[][])||[]).find(row=>row[0]===enemyId)?.[1]||0,em=moveFor(record,enemyId,enemyLevel,random,battle.enemyName,"你"),attacker=enemy(record,battle.enemyFp,em),target=player(actor,blank);battle.log.push(em.text);const received=attackEffect(attacker,target,random);battle.enemyFp=attacker.fp;actor.hp=Math.max(0,actor.hp-received.hurt);battle.log.push(resultText(received,"你"));if(actor.hp<=0){battle.finished="lose";battle.log.push("你眼前一黑，已无力再战。切磋到此为止。");}battle.log=battle.log.slice(-8);return battle;}
export function endSpar(actor:SceneActorState,battle:OriginalBattle){if(battle.finished==="lose")actor.hp=Math.max(1,Math.floor(actor.maxHp/10));return actor;}
