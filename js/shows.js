

let shows={}
export default shows


import      hoard     from "./hoard.js"
import      db        from "./db.js"
import      jxml      from "./jxml.js"

import { configure } from 'safe-stable-stringify'
const stringify = configure({})

import weerss from "./weerss.js"

// cleanup a file name as best we can to be used in search
shows.clean_name=function(name)
{
	name=name.replace(/\s*\[.*?\]\s*/g, ' ') // remove any [tags]
	return name.replace(/'|’/g,"").replace(/[^a-zA-Z0-9]/g," ").replace(/\s+/g," ").trim().toLowerCase()
}


shows.get=async function(url) // always slow
{
	return await db.get("shows",url)
}

shows.set=async function(show)
{
	await db.set("shows",show.url,show)
}


shows.fetch=async function(url,force)
{
	if(!force)
	{
		let ret = await shows.get(url)
		if( ret && ret.data) { return ret.data }
	}
	
	let data = await fetch(url).then(res => res.json())
	if(data)
	{
		await shows.set({url:url,data:data})
	}
	return data
}


shows.prepare=function(show)
{
	return show
}


// lookup show episode on tvmaze, this needs a valid tvmaze id
shows.get_tvmaze_episode=async function(showid,season,episode)
{
	await new Promise(resolve => setTimeout(resolve, 500)) // do not spam requests

	let ret=null
	
	try{ // on network errors, just return nil

		let qurl="https://api.tvmaze.com/shows/"+showid+"/episodebynumber?season="+season+"&number="+episode
		let text=await hoard.fetch_text(qurl)
		ret=JSON.parse(text)
	}catch(e){console.log(e)}

	return ret
}

// lookup show on tvmaze
shows.get_tvmaze=async function(show,force)
{
	await new Promise(resolve => setTimeout(resolve, 500)) // do not spam requests

	try{ // on network errors, just return non tvmaze info

		let show_year
		let show_country
		let show_name=show.name
		let qurl="https://api.tvmaze.com/singlesearch/shows?q="+show_name.replaceAll(" ","+")
		let tvmaze=await shows.fetch(qurl,force)

		if(!tvmaze) // maybe try again
		{
			if( show_name.match(/\s\d\d\d\d$/i) ) // maybe a four digit year
			{
				show_year=show_name.substring(show_name.length-4)
				show_name=show_name.substring(0,show_name.length-5)
				qurl="https://api.tvmaze.com/singlesearch/shows?q="+show_name.replaceAll(" ","+")
				tvmaze=await shows.fetch(qurl,force)
				if(tvmaze)
				{
					show.year=show_year // remember the year we removed
				}
			}
		}
		
		if(!tvmaze) // maybe try again
		{
			if( show_name.match(/\s\w\w$/i) ) // maybe a two letter country code
			{
				show_country=show_name.substring(show_name.length-2)
				show_name=show_name.substring(0,show_name.length-3)
				qurl="https://api.tvmaze.com/singlesearch/shows?q="+show_name.replaceAll(" ","+")
				tvmaze=await shows.fetch(qurl,force)
				if(tvmaze)
				{
					show.country=show_country // remember the country we removed
				}
			}
		}
		
		if(tvmaze && tvmaze.name=="Too Many Requests") // ERROR
		{
			tvmaze=undefined
		}

		show.tvmaze=tvmaze
		show.id=tvmaze && tvmaze.id

	}catch(e){console.log(e)}

	return show.tvmaze
}

// guess the show and series/episode or movie from an item
shows.get_show=async function(filename)
{	
	let item_tags
	let item_name
	let item_season
	let item_episode
	let item_date
	
	let name=filename
	if(!name){return} // give up
	
	if(!item_name)
	{
		let aa=name.match(/(.*)S(\d\d+)E(\d\d+)(.*)/i)
		if(aa) // found a season
		{
			item_name=shows.clean_name(aa[1])
			item_season=Number(aa[2])
			item_episode=Number(aa[3])
			item_tags=shows.clean_name(aa[4]).split(" ")
		}
	}

// try and match a date if we did not find an episode ?
	if(!item_name)
	{
		let aa=name.match(/(.*)(\d\d\d\d)\D(\d\d)\D(\d\d)(.*)/i)
		if(aa) // found a data
		{
			item_name=aa[1].replace(/[^a-zA-Z0-9]/g," ").replace(/\s+/g," ").trim().toLowerCase()
			item_season=Number(aa[2]) // season is the year
			item_episode=Number(aa[3]+aa[4]) // join month and day to make a 4 digit episode number
			item_tags=aa[5].replace(/[^a-zA-Z0-9]/g," ").replace(/\s+/g," ").trim().toLowerCase().split(" ")
			item_date=aa[2]+"-"+aa[3]+"-"+aa[4]
		}
	}
	
	if(!item_name){return} // give up

	let show={
		name:item_name,
		tags:item_tags,
		season:item_season,
		episode:item_episode,
		date:item_date,
	}
	
	await shows.get_tvmaze(show)

	return show
}

// guess the show and series/episode or movie from an item
shows.fill_show=async function(item)
{	

	item.show=await shows.get_show(item.torrent.file_name)	
	if( (item.show) && (item.show.tvmaze) )
	{
		if( !item.show.date ) // need a date so ask tvmaze
		{
			item.tvmaze_episode=await shows.get_tvmaze_episode( item.show.id , item.show.season , item.show.episode )
			if( item.tvmaze_episode )
			{
				item.show.date=item.tvmaze_episode.airdate
			}
		}
	}
	
	item.show=item.show||{fail:true}

	return item
}


let check_flags=function(flags,rules)
{
	let good=false

if(weerss.config.debug)
{
	console.log("checking rules",flags)
}
	
	for( let rule of rules )
	{
		for( let s of rule )
		{
			if( "string" == typeof s ) // all these must be true
			{
				if( s.startsWith("!") )
				{
					s=s.substring(1)
					if( flags[s] ) { break }
				}
				else
				{
					if( !flags[s] ) { break }
				}
			}
			else
			if( "boolean" == typeof s ) // to set this flag
			{
if(weerss.config.debug)
{
	console.log("rule matched",rule)
}
				good=s
				break
			}
		}
		
	}
if(weerss.config.debug)
{
	console.log("result",good,"\n")
}
	return good
}

// is this show good?
shows.good_show=function(show,rules)
{
	if( !rules ) { return true }
	
	let tvmaze=show.tvmaze||{}
	
	let flags={}
	if( tvmaze.language ) { flags[ tvmaze.language.trim().toLowerCase() ]=true }
	if( tvmaze.type     ) { flags[ tvmaze.type.trim().toLowerCase()     ]=true }
	if( tvmaze.genres )
	for( let genre of tvmaze.genres || [] )
	{
		flags[ genre.trim().toLowerCase() ]=true
	}
	
	return check_flags(flags,rules)
}

// is this episode good?
shows.good_episode=function(show,rules)
{
	if( !rules ) { return true }

	let flags={}
	for( let tag of show.tags || [] )
	{
		flags[ tag.trim().toLowerCase() ]=true
	}

	return check_flags(flags,rules)
}
