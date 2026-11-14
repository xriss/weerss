
let db={}
export default db


import { DatabaseSync } from 'node:sqlite';

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

	db.handle = new DatabaseSync( weerss.get_config_path("sqlite") );

//	db.handle.inner.on("trace", (sql) => console.log("[TRACE]", sql));

	db.handle.exec("PRAGMA synchronous = 0 ;");
	db.handle.exec("PRAGMA encoding = \"UTF-8\" ;");
	db.handle.exec("PRAGMA journal_mode=WAL;");
	db.handle.exec("PRAGMA mmap_size=268435456;");
	db.handle.exec("PRAGMA temp_store=2;");


	db.handle.exec(`

		CREATE TABLE IF NOT EXISTS keyval
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);

    `);

	db.handle.exec(`

		CREATE TABLE IF NOT EXISTS hoard
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);

    `);

	db.handle.exec(`

		CREATE TABLE IF NOT EXISTS feeds
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);

    `);

	db.handle.exec(`

		CREATE TABLE IF NOT EXISTS items
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);

    `);

	db.handle.exec(`

		CREATE TABLE IF NOT EXISTS torrents
		(
			key STRING PRIMARY KEY ,
			value JSONB NOT NULL
		);

    `);

	db.handle.exec(`

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
	let row=db.handle.prepare(`

		SELECT * FROM ${table}
		WHERE key=$key;

	`).get({$key:key})
	return row && row.value && JSON.parse(row.value)
}

db.set=async function(table,key,value)
{
	table=table||"keyval"
	db.handle.prepare(`

		INSERT INTO ${table} (key,value)
		VALUES ($key,$value)
		ON CONFLICT (key)
		DO
			UPDATE SET value = $value
			WHERE key = $key;

	`).run({$value:stringify(value),$key:key})
}


db.clear=async function(table)
{
	table=table||"keyval"
	db.handle.exec(`

		DELETE FROM ${table};

	`)

}

db.vacuum=async function()
{
	db.handle.exec(`

		VACUUM;

	`)
}

db.delete=async function(table,key)
{
	table=table||"keyval"
	db.handle.prepare(`

		DELETE FROM ${table} WHERE key=$key;

	`).run({key:key})
}

db.clean=async function(table)
{
	for ( const row of db.handle.prepare(`

		SELECT * FROM ${table}

	`).iterate({}) )
	{
		try{
			JSON.parse(row.value)
		}catch(e){
			console.log("removing broken json for "+row.key)
			db.delete(table,row.key)
		}
	}
}

db.list=async function(table,filter,cb)
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

	for ( const row of db.handle.prepare(`

		SELECT * FROM ${table}
		${filters}

	`).iterate({}) )
	{
		let v=JSON.parse(row.value)
		if((!cb)||(cb(row.key,v)))
		{
			rs.push(v)
		}
	}

	return rs // filtered only, sorted by date
}
