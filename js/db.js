
let db={}
export default db


import { AsyncDatabase } from "promised-sqlite3"

import { configure } from 'safe-stable-stringify'
const stringify = configure({})

import weerss from "./weerss.js"


db.test=async function()
{
	await db.setup()
	await db.set(null,"hello","world")
	await db.set(null,"hell","{world:poop}")
	
	console.log( await db.list() )
	
	await db.close()
}



db.name="weerss"

db.setup=async function()
{

	db.handle = await AsyncDatabase.open( weerss.get_config_path("sqlite_filename") );

//	db.handle.inner.on("trace", (sql) => console.log("[TRACE]", sql));

	await db.handle.run("PRAGMA synchronous = 0 ;");
	await db.handle.run("PRAGMA encoding = \"UTF-8\" ;");
	await db.handle.run("PRAGMA journal_mode=WAL;");
	await db.handle.run("PRAGMA mmap_size=268435456;");
	await db.handle.run("PRAGMA temp_store=2;");


	await db.handle.run(`
 
		CREATE TABLE IF NOT EXISTS keyval
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);
 
    `);

	await db.handle.run(`
 
		CREATE TABLE IF NOT EXISTS hoard
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);
 
    `);

	await db.handle.run(`
 
		CREATE TABLE IF NOT EXISTS feeds
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);
 
    `);

	await db.handle.run(`
 
		CREATE TABLE IF NOT EXISTS items
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);
 
    `);

	await db.handle.run(`
 
		CREATE TABLE IF NOT EXISTS torrents
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);
 
    `);

	await db.handle.run(`
 
		CREATE TABLE IF NOT EXISTS shows
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);
 
    `);

}

db.close=async function()
{
	await db.handle.close()
	db.handle=null
}

db.get=async function(table,key)
{
	table=table||"keyval"
	let row=await db.handle.get(`

		SELECT * FROM ${table}
		WHERE key=$key;

	`,{$key:key})
	return row && row.value && JSON.parse(row.value)
}

db.set=async function(table,key,value)
{
	table=table||"keyval"
	await db.handle.run(`

		INSERT INTO ${table} (key,value)
		VALUES ($key,$value)
		ON CONFLICT (key)
		DO 
			UPDATE SET value = $value
			WHERE key = $key;

	`,{$key:key,$value:stringify(value)})
}


db.clear=async function(table)
{
	table=table||"keyval"
	await db.handle.run(`

		DELETE FROM ${table};

	`,{})
}

db.delete=async function(table,key)
{
	table=table||"keyval"
	await db.handle.run(`

		DELETE FROM ${table} WHERE key=$key;

	`,{$key:key})
}

db.list=async function(table,filter)
{
	table=table||"keyval"
	filter=filter || {}
	let rs=[]
	
	let filters=[]
	for(let fb in filter)
	{
		let fv=filter[fb]
		if(typeof fv=="Number")
		{
			fv=String(fv)
		}
		else
		{
			fv='"'+String(fv)+'"'
		}

		if(fb.endsWith("_is_null"))
		{
			let f=fb.substring(0,fb.length-8)
			filters.push(" json_extract (value, '$."+f+"') IS NULL ")
		}
		else
		if(fb.endsWith("_is_not_null"))
		{
			let f=fb.substring(0,fb.length-12)
			filters.push(" json_extract (value, '$."+f+"') IS NOT NULL ")
		}
		else
		if(fb.endsWith("_lt"))
		{
			let f=fb.substring(0,fb.length-3)
			filters.push(" json_extract (value, '$."+f+"') < "+fv)
		}
		else
		if(fb.endsWith("_lteq"))
		{
			let f=fb.substring(0,fb.length-5)
			filters.push(" json_extract (value, '$."+f+"') <= "+fv)
		}
		else
		if(fb.endsWith("_gt"))
		{
			let f=fb.substring(0,fb.length-3)
			filters.push(" json_extract (value, '$."+f+"') > "+fv)
		}
		else
		if(fb.endsWith("_gteq"))
		{
			let f=fb.substring(0,fb.length-5)
			filters.push(" json_extract (value, '$."+f+"') >= "+fv)
		}
		else
		if(fb.endsWith("_not"))
		{
			let f=fb.substring(0,fb.length-4)
			filters.push(" json_extract (value, '$."+f+"') != "+fv)
		}
		else
		{
			filters.push(" json_extract (value, '$."+fb+"') = "+fv)
		}
	}
	if( filters.length==0 )
	{
		filters=""
	}
	else
	{
		filters="WHERE "+filters.join(" AND\n")
	}
//	console.log(filters)
	
	await db.handle.each(`
	
		SELECT * FROM ${table}
		${filters}

	`,{},function(row)
	{
		rs.push(JSON.parse(row.value))
	})

	return rs // filtered only, sorted by date
}
