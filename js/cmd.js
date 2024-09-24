
const cmd={}
export default cmd


import minimist from "minimist"

import path from "path"
import url from "url"

import serv from "./serv.js"
import db from "./db.js"

import hoard from "./hoard.js"
import feeds from "./feeds.js"
import items from "./items.js"

import weerss from "./weerss.js"

const args = minimist(process.argv.slice(2),{boolean:true})

args.config=args.config || process.env.WEERSS_CONFIG

await weerss.load_config(args)

let arg1=args._[0] || "help"
let arg2=args._[1]

if( arg1=="help" )
{
	console.log(`

options:

	Load config file, you should always load your custom config for all 
	of the following commands...

		--config=weerss.config

	environment variables can also set options with the prefix WEERSS_ 
	and the option name in all uppercase. eg:

		export WEERSS_CONFIG=/home/dave/weerss.config

commands:

tvrss config
	Print current config.

tvrss config FILENAME
	Save current (default?) config to FILENAME.

tvrss fetch
	Fetch all feeds and scan files with tvmaze.

tvrss list
	List torrents in db.

tvrss rss
	Save torrents as rss.

tvrss move
	Move downloaded chaotic files to an organised location.

tvrss dirs
	Create a script to cleanup TV dirs using tvmaze.

tvrss help
	Print this help message.

`)
}
else
if( arg1=="config" )
{
	await weerss.save_config(args)
}
else
if( arg1=="fetch" )
{
	await weerss.fetch(args)
}
else
if( arg1=="list" )
{
	await weerss.list(args)
}
else
if( arg1=="rss" )
{
	await weerss.save_rss(args)
}
else
if( arg1=="move" )
{
	await weerss.move(args)
}
else
if( arg1=="dirs" )
{
	await weerss.dirs(args)
}
else
{
	console.log(` Unknown weerss command "${arg1}" `)
}
