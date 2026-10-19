import fs from "node:fs/promises";
import path from "node:path";
import {deflateRawSync} from "node:zlib";
const manifest=JSON.parse(await fs.readFile("module.json","utf8"));
await fs.mkdir("dist",{recursive:true});
const stage=path.resolve("dist",`package-${manifest.version}`);
// Keep staging predictable and validate every deletion target inside dist.
if (!stage.startsWith(path.resolve("dist")+path.sep)) throw new Error("Unsafe staging path");
await fs.rm(stage,{recursive:true,force:true}); await fs.mkdir(stage,{recursive:true});
for (const item of ["module.json","scripts","styles","templates","lang","README.md","LICENSE","CHANGELOG.md","docs"]) await fs.cp(item,path.join(stage,item),{recursive:true});
const archive=path.resolve("dist","dominion-briefing-planner.zip");
// Standard ZIP (UTF-8, raw DEFLATE), using only the Node standard library.
const table=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=data=>{let crc=0xffffffff;for(const b of data)crc=table[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;};
async function files(dir,prefix="") {
  const result=[];
  for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    const name=prefix+entry.name;
    if(entry.isDirectory())result.push(...await files(path.join(dir,entry.name),name+"/"));else result.push(name);
  }return result;
}
const local=[],central=[];let offset=0;
for(const name of await files(stage)) {
  const raw=await fs.readFile(path.join(stage,name)),compressed=deflateRawSync(raw),filename=Buffer.from(name,"utf8"),crc=crc32(raw);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(0x21,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(filename.length,26);
  local.push(header,filename,compressed);
  const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(0x21,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(raw.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);
  central.push(record,filename);offset+=header.length+filename.length+compressed.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
await fs.writeFile(archive,Buffer.concat([...local,directory,end]));
await fs.copyFile("module.json","dist/module.json");
console.log(`Built ${archive}`);
