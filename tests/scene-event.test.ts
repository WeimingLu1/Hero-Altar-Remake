import assert from "node:assert/strict";
import test from "node:test";
import { applySceneResolution, resolveSceneEvent, type SceneActorState } from "../app/game-core/scene-event";
const actor=():SceneActorState=>({inventory:{},gold:0,hp:50,maxHp:100,fp:50,maxFp:100,food:0,water:0,exp:0,potential:0,morals:0,tanId:0,teacherId:0,classId:0,gender:0,face:20,mp:0,maxMp:0,age:14,baseBon:20,baseInt:20,baseAgi:20,baseStr:20,bon:20,int:20,agi:20,str:20,luck:20,skills:{},weaponId:0,armorIds:[],skillUse:[0,0,0,0,0,0],fpPlus:0});
test("NPC event resolves original named dialogue",()=>{const r=resolveSceneEvent({type:0,id:1},actor(),0);assert.match(r.lines[0],/豆腐|客官/);assert.equal(r.tag,"npc:1");});
test("find-item event uses original indexed database and mutates inventory",()=>{const a=actor(),r=resolveSceneEvent({type:1,id:8,extra:2},a);assert.match(r.lines[0],/金创药/);applySceneResolution(a,r);assert.equal(a.inventory["1:8"],2);});
