import { originalTables } from "./original-data";
import type { SceneActorState } from "./scene-event";
import { kungfuSchoolName } from "./kungfu-school";
export type LearnedSkill={id:number;name:string;level:number;points:number;type:number;slot:number|null;equipped:boolean;parrying:boolean;category:string;school:string};
export const skillLevel=(actor:SceneActorState,id:number)=>actor.skills[String(id)]?.level||0;
export const skillType=(id:number)=>Number(originalTables.kungfus[id]?.type||0);
export function naturalSlot(id:number){const type=skillType(id);if(type===2)return 0;if(type>=3&&type<=7)return 1;if(type===9)return 2;if(type===1)return 3;if(type===8)return 5;if(type===11)return 6;return null;}
const skillCategories=["未知","内功心法","拳脚武学","剑术","刀法","杖法","鞭法","棍法","术法","轻功身法","招架根基","学识秘术"];
export function learnedSkills(actor:SceneActorState):LearnedSkill[]{return Object.entries(actor.skills).filter(([,s])=>s.level>0).map(([raw,s])=>{const id=Number(raw),type=skillType(id),slot=naturalSlot(id);return{id,name:String(originalTables.kungfus[id]?.name||id),level:s.level,points:s.points,type,slot,equipped:slot!==null&&actor.skillUse[slot]===id,parrying:actor.skillUse[4]===id,category:skillCategories[type]||"奇门武学",school:kungfuSchoolName(id)};});}
export function equipSkill(actor:SceneActorState,id:number){if(id<12)return {ok:false,text:"基本功夫无需装备。"};const slot=naturalSlot(id);if(slot===null)return {ok:false,text:"此门功夫无法装备。"};actor.skillUse[slot]=actor.skillUse[slot]===id?0:id;if(actor.skillUse[slot]===0&&actor.skillUse[4]===id)actor.skillUse[4]=0;return {ok:true,text:`${originalTables.kungfus[id]?.name}${actor.skillUse[slot]===id?"已装备":"已卸下"}。`};}
export function toggleParry(actor:SceneActorState,id:number){const valid=id===10||(id>11&&(id===actor.skillUse[0]||id===actor.skillUse[1]));if(!valid)return {ok:false,text:"只有基本招架或当前拳脚、兵刃功夫可以用于招架。"};actor.skillUse[4]=actor.skillUse[4]===id?0:id;return {ok:true,text:`${originalTables.kungfus[id]?.name}${actor.skillUse[4]===id?"设为招架":"取消招架"}。`};}
export function weaponBasicId(weaponId:number){return Number(originalTables.weapons[weaponId]?.type||0)+3;}
export function weaponMatches(actor:SceneActorState){const id=actor.skillUse[1];return id>0&&actor.weaponId>0&&skillType(id)-3===Number(originalTables.weapons[actor.weaponId]?.type||0);}
export function effectiveLevel(actor:SceneActorState,id:number){return Math.floor(skillLevel(actor,skillType(id))/2)+(id>=12?skillLevel(actor,id):0);}
// 驻颜术(22)：需在学识槽装备，有效容貌 = 基础容貌 + 驻颜术等级/10。
export function effectiveFace(actor:SceneActorState){return actor.skillUse[6]===22?actor.face+Math.floor(skillLevel(actor,22)/10):actor.face;}
export function combatSkillProfile(actor:SceneActorState){const hand=actor.skillUse[0]||2,dodge=actor.skillUse[2]||9,weapon=actor.skillUse[1],attackId=actor.weaponId>0?(weaponMatches(actor)?weapon:weaponBasicId(actor.weaponId)):hand;const attack=actor.weaponId>0?(weaponMatches(actor)?effectiveLevel(actor,weapon):Math.floor(skillLevel(actor,weaponBasicId(actor.weaponId))/2)):effectiveLevel(actor,hand);let parry=Math.floor(skillLevel(actor,10)/2);const active=actor.weaponId>0?weapon:hand;if(actor.skillUse[4]===active&&(!actor.weaponId||weaponMatches(actor)))parry+=skillLevel(actor,active);return{attackId,attack,dodge:effectiveLevel(actor,dodge),parry};}
