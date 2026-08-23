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
// 原作规则：只有基本招架或当前运用的拳脚、兵刃武学可以设为招架；
// 菜单据此决定是否显示“设为招架”入口，与 toggleParry 同一判定。
export function canParryWith(actor:SceneActorState,id:number){return id===10||(id>11&&(id===actor.skillUse[0]||id===actor.skillUse[1]));}
export function toggleParry(actor:SceneActorState,id:number){if(!canParryWith(actor,id))return {ok:false,text:"只有基本招架或当前拳脚、兵刃功夫可以用于招架。"};actor.skillUse[4]=actor.skillUse[4]===id?0:id;return {ok:true,text:`${originalTables.kungfus[id]?.name}${actor.skillUse[4]===id?"设为招架":"取消招架"}。`};}
export function battleCombatSkills(actor:SceneActorState){return learnedSkills(actor).filter((skill)=>skill.id>=12&&skill.type>=2&&skill.type<=7).sort((a,b)=>a.type-b.type||a.id-b.id);}
export function selectBattleCombatSkill(actor:SceneActorState,id:number,parry=false){const slot=naturalSlot(id);if(id<12||slot===null||![0,1].includes(slot))return{ok:false,text:"这门武学不能作为临阵攻防功夫。"};actor.skillUse[slot]=id;if(parry)actor.skillUse[4]=id;return{ok:true,text:`${originalTables.kungfus[id]?.name}已设为${parry?"招架":"当前攻击"}武学。`};}
export function battleSkillWeaponText(actor:SceneActorState,id:number){const type=skillType(id);if(type===2)return actor.weaponId>0?"需空手施展":"当前可用";if(type>=3&&type<=6){if(actor.weaponId<=0)return"需装备对应兵器";return weaponBasicId(actor.weaponId)===type?"当前兵器匹配":"当前兵器不匹配";}return"当前可用";}
export function weaponBasicId(weaponId:number){
  const type =
    weaponId >= 31 && weaponId <= 34
      ? weaponId - 31
      : Number(originalTables.weapons[weaponId]?.type || 0);
  return type + 3;
}
export function weaponMatches(actor:SceneActorState){
  const id=actor.skillUse[1];
  if (id <= 0 || actor.weaponId <= 0) return false;
  const wtype =
    actor.weaponId >= 31 && actor.weaponId <= 34
      ? actor.weaponId - 31
      : Number(originalTables.weapons[actor.weaponId]?.type || 0);
  return skillType(id) - 3 === wtype;
}
export function effectiveLevel(actor:SceneActorState,id:number){return Math.floor(skillLevel(actor,skillType(id))/2)+(id>=12?skillLevel(actor,id):0);}
// 选中武学时的效果说明：按战斗、修炼与学识的真实公式换算成当前人物数值，
// 纯展示不改状态；没有特殊效果的武学也要如实注明。
export function skillEffectSummary(actor:SceneActorState,skill:LearnedSkill):string[]{
  const lines:string[]=[],eff=effectiveLevel(actor,skill.id),knowledgeOn=actor.skillUse[6]===skill.id;
  if(skill.type===1){
    lines.push(`内功有效等级 ${eff} · 加力上限 ${Math.floor(eff/2)} · 根骨+${Math.floor(skill.level/10)}`);
    lines.push("打坐与内力上限增长的基础，加力等内力菜单需先装备内功");
  }else if(skill.type===2){
    lines.push(`空手攻击有效等级 ${eff} · 膂力+${Math.floor(skill.level/10)}`);
    if(skill.id>11)lines.push(canParryWith(actor,skill.id)?`设为招架时招架+${skill.level}`:"设为当前运用后才能用于招架");
  }else if(skill.type>=3&&skill.type<=7){
    const matched=actor.weaponId>0&&weaponBasicId(actor.weaponId)===skill.type;
    lines.push(`${skill.category}攻击有效等级 ${eff} · ${actor.weaponId>0?(matched?"当前兵器匹配":"当前兵器不匹配"):"需装备对应兵器"}`);
    lines.push(canParryWith(actor,skill.id)?`设为招架时招架+${skill.level}`:"设为当前运用后才能用于招架");
  }else if(skill.type===8){
    lines.push(`法术精通 ${Math.min(300,eff)} · 装备法术槽后施展该系咒法，精通提高法术伤害与附效概率`);
  }else if(skill.type===9){
    lines.push(`闪避有效等级 ${eff} · 敏捷+${Math.floor(skill.level/10)}`);
  }else if(skill.type===10){
    lines.push(`招架基础 +${Math.floor(skill.level/2)} · 可直接设为招架功夫`);
  }else if(skill.type===11){
    const lv=skill.level;
    if(skill.id===22)
      lines.push(`容貌评价+${Math.floor(lv/10)}，当前有效容貌 ${effectiveFace(actor)}${knowledgeOn?" · 学识槽生效中":" · 未装备学识槽，暂不生效"}`);
    else if(skill.id===27){
      const bonus=Math.floor((lv*actor.baseBon)/10),active=actor.classId===3&&lv>=80&&actor.age>=20;
      lines.push(`红莲教弟子80级且成年后装备学识槽：气血上限+${bonus}${active&&knowledgeOn?" · 当前生效中":" · 条件未满足或未装备时不生效"}`);
    }else if(skill.id===48)
      lines.push(`变熊术强化：膂力额外+${Math.floor(lv/8)}·防御额外+${lv}·持续+${Math.floor(lv/15)}回合${knowledgeOn?" · 学识槽生效中":" · 未装备学识槽，暂不生效"}`);
    else if(skill.id===55)
      lines.push("无特殊战斗效果（与原版一致），仅作道教学识");
    else if(skill.id===56)
      lines.push(`普通攻击命中后按伤害的${lv}%吸回气血${knowledgeOn?" · 学识槽生效中":" · 未装备学识槽，暂不生效"}`);
    else if(skill.id===11)
      lines.push(`悟性+${Math.floor(lv/10)} · 研读秘籍的门槛学识，无需装备`);
    else
      lines.push("无特殊战斗效果");
  }
  return lines.length?lines:["无特殊效果"];
}
// 驻颜术(22)：需在学识槽装备，有效容貌 = 基础容貌 + 驻颜术等级/10。
export function effectiveFace(actor:SceneActorState){return actor.skillUse[6]===22?actor.face+Math.floor(skillLevel(actor,22)/10):actor.face;}
export function combatSkillProfile(actor:SceneActorState){const hand=actor.skillUse[0]||2,dodge=actor.skillUse[2]||9,weapon=actor.skillUse[1],attackId=actor.weaponId>0?(weaponMatches(actor)?weapon:weaponBasicId(actor.weaponId)):hand;const attack=actor.weaponId>0?(weaponMatches(actor)?effectiveLevel(actor,weapon):Math.floor(skillLevel(actor,weaponBasicId(actor.weaponId))/2)):effectiveLevel(actor,hand);let parry=Math.floor(skillLevel(actor,10)/2);const active=actor.weaponId>0?weapon:hand;if(actor.skillUse[4]===active&&(!actor.weaponId||weaponMatches(actor)))parry+=skillLevel(actor,active);return{attackId,attack,dodge:effectiveLevel(actor,dodge),parry};}
