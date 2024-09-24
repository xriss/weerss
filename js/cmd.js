
const cmd={}
export default cmd


import mri from "mri"

import path from "path"
import url from "url"

import serv from "./serv.js"
import db from "./db.js"

import hoard from "./hoard.js"
import feeds from "./feeds.js"
import items from "./items.js"

import weerss from "./weerss.js"

const args = mri(process.argv.slice(2))
//console.log(args)

args.config=args.config || process.env.WEERSS_CONFIG || process.env.HOME+"/.config/weerss/config.djon"

await weerss.load_config(args)

let arg1=args._[0] || "help"
let arg2=args._[1]
let arg3=args._[3]

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

All options are loaded into this config structure with . used as an 
object seperator and the value parsed as json.

EG To choose the number of items in your rss feed from the command line 
and thus overide the config file setting.

	--rss.length=100
or
	--rss='{length:100}'

With the later removing any other values in the rss object while the 
former just changes the legth value.

commands:

weerss config
	Create a default to config file if we do not already have one and 
	then print the current config. I recomend reading the default 
	config file for comments about how to configure weerss.

weerss config --force
	Force saving of default config over current config.

weerss fetch
	Fetch all feeds and scan files with tvmaze.

weerss list
	List torrents in db.

weerss rss
	Save torrents as rss.

weerss move
	Move downloaded chaotic files to an organised jellyfin style 
	directory.

weerss dirs
	Create a script to cleanup TV dirs using tvmaze. This does not do 
	any cleanup just prints bash commands that you may wish to run 
	later.

weerss help
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
