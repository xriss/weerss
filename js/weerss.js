
const weerss={}
export default weerss

//import serv from "./serv.js"

import db from "./db.js"
import jxml from "./jxml.js"

import hoard from "./hoard.js"
import feeds from "./feeds.js"
import items from "./items.js"
import torrents from "./torrents.js"
import shows from "./shows.js"


import util from "util"
import {moveFile} from 'move-file'

import { promises as pfs } from "fs"
import fs from "fs"
import path from "path"

import sanitize from "sanitize-filename"

import djon from "@xriss/djon"



weerss.config_default=`
{
 // set to true for verbose rule checking
 debug = FALSE
 // array of url to rss feeds of torrent files
 feeds = [
  "https://archive.org/services/collection-rss.php?collection=television_inbox"
 ]
 rss = {
  // number of episodes to list in the rss files
  length = 100
 }
 // decide which shows we like ( data from tvmaze )
 show = {
  rules = [
   [ TRUE ]
   [ "!english" FALSE ]
  ]
 }
 // decide which episode we like tags come from filename
 episode = {
  best = "small"
  maxsize = 4000000000
  minsize = 1000000
  rules = [
   [ TRUE ]
   [ "480p" FALSE ]
  ]
 }
 // paths can be relative to this config files location
 paths = {
  rss = "./weerss.rss"
  sqlite = "./weerss.sqlite"
  download = "./download"
  tv = "./TV"
 }
}
`

weerss.config=djon.load(weerss.config_default)

weerss.load_config=async function(args)
{
	if(args.config)
	{
		if( fs.existsSync(args.config) ) // only load if files exists
		{
			console.log(` Loading config from `+args.config)
			weerss.config=djon.load_file(args.config)

			let def=djon.load(weerss.config_default)
			for(let n in def )
			{
				if( typeof weerss.config[n] == "undefined" ) // use defaults
				{
					weerss.config[n] = def[n]
				}
			}
		}
		else // reset
		{
			weerss.config=djon.load(weerss.config_default)
		}
	}
	for(let n in args ) // set from args
	{
		if(n!="_")
		{
			let va=args[n]
			try{ va=djon.load(va) }catch(e){} // if can parse
			let ns=n.split(".")
			let f=ns.pop()
			let b=weerss.config
			for( let v of ns ) { b=b[v] } // sub sets
			b[f]=va
		}
	}
}

weerss.save_config=async function(args)
{
	if(args.config) // need a config location
	{
		if( (!args.force) && fs.existsSync(args.config) ) // must not already exist
		{
			console.log( "Config already exists : "+args.config )
			console.log( djon.save(weerss.config,"djon","strict") )
		}
		else // write defaukt config
		{
			console.log( "Writing config to : "+args.config )
			try{ await pfs.mkdir( path.dirname(args.config) ) }catch(e){}
			fs.writeFileSync( args.config , weerss.config_default )
		}
	}
	else
	{
		console.log( "Must specify config file with --config=~/.weerss.config " )
	}
}

weerss.get_config_path=function(name)
{
	let d
	if( weerss.config.config ) // relative to config path
	{
		d=path.dirname( path.resolve(weerss.config.config) )
	}
	else
	{
		d=path.resolve( "." )
	}

	let f=weerss.config.paths[name] || "."
	if( ! path.isAbsolute(f) )
	{
		f=path.join( d , f )
	}

	return f
}

//console.log( djon.save(weerss.config) )


let item_to_string=function(item)
{
	let torrent=item.torrent || {}
	let show=item.show || {}
	let tvmaze=show.tvmaze || {}
	let siz=Math.floor((torrent.file_length||0)/(1024*1024)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")+".MB"
	let SxxExx=("S"+(show.season||0).toString().padStart(2, "0")+"E"+(show.episode||0).toString().padStart(2, "0") )
	let airdate=show.date || ""
	return ( siz.padStart(9, " ")+" "+(tvmaze.name||torrent.file_name||item.uuid)+" "+SxxExx+" "+airdate)
}

weerss.fetch=async function()
{
	await db.setup()
//	db.clear("hoard") // delete cache on startup

// clear cached data
	db.clear("torrents")
	db.clear("hoard")

	for(let feed of await db.list("feeds") )
	{
		let keep=false
		for(let url of weerss.config.feeds)
		{
			if(url==feed.url)
			{
				keep=true
			}
		}
		if(!keep)
		{
			console.log("removing old feed",feed.url)
			await db.delete("feeds",feed.url)
		}
	}


	for(let url of weerss.config.feeds)
	{
		await feeds.add({url:url})
	}
	await feeds.fetch_all()

	{
		let its=await db.list("items",{torrent_is_null:1})
		console.log("Checking torrents : "+its.length)
		for(let item of its)
		{
			console.log(item.uuid)
			await torrents.fill_torrent(item)
			console.log(item.torrent)
			items.set(item)
		}
	}

	{
		let its=await db.list("items",{show_is_null:1,torrent_is_not_null:1})
		console.log("Checking shows : "+its.length)
		for(let item of its)
		{
			await shows.fill_show(item)

			console.log( item_to_string(item) )

			items.set(item)
		}
	}


//	await db.vacuum() // keep db size small?
	await db.close()
}

weerss.getlist=async function()
{
	// all items then we sort and filter and list
	let its=await db.list("items",{})

	let buckets={}
	let itemshows={}

	for(let item of its)
	{
		if(!item.show) { continue }
//		if(!item.show.tvmaze) { continue }
		if(item.show.fail) { continue }

//		let bid=item.show.id+"_"+item.show.season+"_"+item.show.episode

		let SxxExx=("S"+item.show.season.toString().padStart(2, "0")+"E"+item.show.episode.toString().padStart(2, "0") )

		if(!buckets[item.show.id]){buckets[item.show.id]={}}
		if(!buckets[item.show.id][SxxExx]){buckets[item.show.id][SxxExx]=[]}

		buckets[item.show.id][SxxExx].push(item)

		itemshows[item.show.id] = item.show
	}

	let list=[]
	for( let showid in itemshows )
	{
		let show=itemshows[showid]

		if( show.tvmaze )
		{
			if( ! shows.good_show(show,weerss.config.show.rules) ) // skip this show?
			{
				continue
			}
//			console.log("SHOW : "+show.tvmaze.name+" + "+(show.tvmaze.type+" "+show.tvmaze.genres.join(" ")).toLowerCase() )

			for( let SxxExx in buckets[showid] )
			{
				let bucket=buckets[showid][SxxExx]
//				console.log( SxxExx + " x " + bucket.length )

				if( weerss.config.episode.maxage )
				{
					for( let it of bucket )
					{
						if( (it.show) && (it.show.date) ) // check all for first episode we find with valid date
						{
							let now=(new Date()).getTime()
							let test=Date.parse(it.show.date)
							let days=Math.floor((now-test)/(1000*60*60*24))
							if( days > weerss.config.episode.maxage ) // this episode is too old
							{
								while( bucket.length > 0){ bucket.pop() } // empty array
							}
							break;
						}
					}
				}

				for( let idx=bucket.length-1 ; idx>=0 ; idx-- ) // remove huge/small files
				{
					let it=bucket[ idx ]
					if( it && it.torrent && it.torrent.file_length )
					{
						if( it.torrent.file_length > weerss.config.episode.maxsize ) // 3GB
						{
							bucket.splice( idx , 1 )
						}

						if( it.torrent.file_length < weerss.config.episode.minsize ) // 3GB
						{
							bucket.splice( idx , 1 )
						}
					}
				}


				if( weerss.config.episode.best == "small" )
				{
					bucket.sort(function(a,b){
						let al=(a && a.torrent && a.torrent.file_length) || 0
						let bl=(b && b.torrent && b.torrent.file_length) || 0
						return al - bl
					})
				}
				else
				if( weerss.config.episode.best == "large" )
				{
					bucket.sort(function(a,b){
						let al=(a && a.torrent && a.torrent.file_length) || 0
						let bl=(b && b.torrent && b.torrent.file_length) || 0
						return bl - al
					})
				}
				else
				{
					error("unknown config.episode.best option")
				}

				while( bucket.length>0 ) // check episode flags ( uses words from filename + all the show flags )
				{
					if( ! shows.good_episode(bucket[ 0 ].show,weerss.config.episode.rules) ) // skip this episode?
					{
						bucket.shift() // remove
					}
					else
					{
						break
					}
				}
//				console.log(aa.join(" "))
//				console.log(bucket[0].show.tags.join(" ") + " : " + Math.floor(bucket[0].torrent.file_length/(1024*1024)) )
				if( bucket[0] )
				{
					list.push( bucket[0] )
				}
			}
		}
		else
		{
//			console.log("UNKNOWN : "+show.name)
		}
	}
	list.sort( function(a,b){
		return new Date(b.date) - new Date(a.date)
	})
	return list
}

weerss.list=async function(args)
{
	await db.setup()

	let list=(await weerss.getlist()).slice(0,weerss.config.rss.length)
	for(let item of list)
	{
		console.log( item_to_string(item))
	}

	await db.close()
}

weerss.save_rss=async function(args)
{
	await db.setup()

	let dates=(new Date()).toUTCString()
	let rss_items=[]
	let dat={
  "/rss@version" : "2.0" ,
  "/rss/channel/language" : "en-us" ,
  "/rss/channel/lastBuildDate" : dates ,
  "/rss/channel/pubDate" : dates ,
  "/rss/channel/description" : "WEERSS" ,
  "/rss/channel/generator" : "WEERSS" ,
  "/rss/channel/link" : "WEERSS" ,
  "/rss/channel/title" : "WEERSS" ,
  "/rss/channel/item" : rss_items ,
}

	let push_item=function(item)
	{
		if(!item.torrent) { return }

		let url=item.torrent.torrent_name

		let dates=(new Date(item.date)).toUTCString()
		let isodates=(new Date(item.date)).toISOString()

		let it={
"/guid" : url ,
"/link" : url ,
"/pubDate" : dates ,
"/size" : item.torrent.torrent_length ,
"/title" : item_to_string(item) ,
"/description" : item_to_string(item) ,
"/enclosure" : [
 {
  "@length" : item.torrent.torrent_length ,
  "@type" : "application/x-bittorrent" ,
  "@url" : url
 }
] ,
}
		rss_items.push(it)
	}

	let list=(await weerss.getlist(weerss.config.show.rules)).slice(0,weerss.config.rss.length)
	for(let item of list)
	{
		push_item(item)
	}


	let fname=weerss.get_config_path("rss")
	if( fname )
	{
		console.log(` Saving rss to `+fname)

		fs.writeFileSync( fname , jxml.build_xml(dat) )
	}
	else
	{
		process.stdout.write( jxml.build_xml(dat) )
	}

	await db.close()
}


weerss.clean=async function(args)
{
	await db.setup()

	await db.clean("items")

	await db.close()
}

weerss.move=async function(args)
{

	let from=weerss.get_config_path("download") //args._[2] // optional dest dir
	let dest=weerss.get_config_path("tv") //args._[2] // optional dest dir

	if(dest)
	{
		console.log( "Moving file from "+from+" to "+dest )
	}
	else
	{
		console.log( "Testing moving files from "+from )
	}

	await db.setup()

	let getallfiles=function(dir, a)
	{
		a = a || []
		let aa = fs.readdirSync(dir)
		aa.forEach(
			function(file)
			{
				if (fs.statSync(dir + "/" + file).isDirectory())
				{
					a = getallfiles(dir + "/" + file, a)
				}
				else
				{
					a.push(path.join(dir, "/", file))
				}
			}
		)
		return a
	}

	let files=getallfiles( from )

	let exts={}
	for( let e of ["mov","avi","mp4","wmv","webm","flv","mkv","vob","ogv","mpg","mpeg"] )
	{ exts["."+e]=true }

	for( let file of files )
	{
		try{ // continue if we get file errors?

			let ext=path.extname(file).toLowerCase()
			let base=path.basename(file)
			if( exts[ext] )
			{
				let show=await shows.get_show(base+ext)
				if( show )
				{
					let SxxExx=("S"+show.season.toString().padStart(2, "0")+"E"+show.episode.toString().padStart(2, "0") )

	//				console.log(base , show.tvmaze.name , show.season , show.episode)
//					let showname=show.tvmaze.name.replace(/[/\\?%*:|"<>]/g, "-") // remove problematic chars

					let tvname=sanitize(show.tvmaze.name,{replacement:""})
					let country=show.tvmaze.network && show.tvmaze.network.country && show.tvmaze.network.country.code
					let year=show.tvmaze.premiered && show.tvmaze.premiered.substr(0,4)
/*
					if(country)
					{
						tvname=tvname+" ("+country+")" // put country in dirname
					}
*/
					if(year)
					{
						tvname=tvname+" ("+year+")" // put year in dirname
					}
					let esctvname=`'${tvname.replace(/'/g, `'\\''`)}'`

					let to = tvname+"/Season "+show.season+"/"+tvname+" "+SxxExx+ext
					console.log(file)

					if( dest )
					{
						to=path.join(dest , to)
						await moveFile(file,to)
						console.log("\t"+to)
					}
					else
					{
						console.log("\t"+to)
					}
				}
			}

		}catch(e){console.log(e)}
	}



	await db.close()
}


weerss.dirs=async function(args)
{
	let dest=weerss.get_config_path("tv")


	await db.setup()

	let getdirs=function(dir, a)
	{
		a = a || []
		let aa = fs.readdirSync(dir)
		aa.forEach(
			function(file)
			{
				if (fs.statSync(dir + "/" + file).isDirectory())
				{
					a.push(path.join(file))
				}
			}
		)
		return a
	}

	let files=getdirs(dest)

	for( let file of files )
	{
//		if( ! file.match(/\((\d\d\d\d)\)/) ) { continue }

		try{ // continue if we get file errors?

			let escfiles=`'${file.replace(/'/g, `'\\''`)}/.'`
			let escdir=`'${file.replace(/'/g, `'\\''`)}'`

//			console.log(file)
			let show={
				name:shows.clean_name(file),
				tags:[],
				season:0,
				episode:0,
			}
			await shows.get_tvmaze(show,true)

//			console.log(show.tvmaze)
			console.log(`echo ${escdir}`)
			if( show.tvmaze )
			{
//console.log(show.tvmaze)
				let tvname=sanitize(show.tvmaze.name,{replacement:""})
				let country=show.tvmaze.network && show.tvmaze.network.country && show.tvmaze.network.country.code
				let year=show.tvmaze.premiered && show.tvmaze.premiered.substr(0,4)
/*
				if(country)
				{
					tvname=tvname+" ("+country+")" // put country in dirname
				}
*/
				if(year)
				{
					tvname=tvname+" ("+year+")" // put year in dirname
				}
				let esctvname=`'${tvname.replace(/'/g, `'\\''`)}'`
				let good=shows.good_show(show,weerss.config.show.rules)
				if(good)
				{
					if(file!=tvname)
					{
						console.log(`cp -rl ${escfiles} ${esctvname}`)
						console.log(`rm -rf ${escdir}`)
					}
				}
				else
				{
					console.log(`rm -rf ${escdir}`)
				}
			}
			else
			{
				console.log(`rm -rf ${escdir}`)
			}

//			await new Promise(resolve => setTimeout(resolve, 500))

		}catch(e){console.log(e)}
	}



	await db.close()
}
