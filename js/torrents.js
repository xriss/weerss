

let torrents={}
export default torrents


import db from "./db.js"
import hoard from "./hoard.js"

import WebTorrent from 'webtorrent'
import { remote } from 'parse-torrent'
import memchunks from 'memory-chunk-store'

torrents.get=async function(url) // always slow
{
	return await db.get("torrents",url)
}

torrents.set=async function(torrent)
{
	await db.set("torrents",torrent.url,torrent)
}


torrents.fetch=async function(url)
{
	let ret = await torrents.get(url)
	if( ret && ret.data) { return ret.data }
	

	// resolve url ( which may redirect to a magnet, damn you jacket )
	while(url.toLowerCase().startsWith("http"))
	{
		let r=await fetch(url, { redirect: 'manual' })
		if( r && r.status>=300 && r.status<=399  )
		{ 
			let location=r.headers.get("location")
			if(url==location) { break }
			url=location
		}
		else // finished
		{
			break
		}
	}

	let urlplus=url
	if(urlplus.toLowerCase().startsWith("magnet:")) // auto add trackers
	{
		let trackers=(await hoard.fast_text("https://newtrackon.com/api/stable")).split("\n")
		let count=0
		for(let t of trackers)
		{
			t=t.trim()
			if(t!="")
			{
				urlplus=urlplus+"&tr="+encodeURIComponent(t)
				count=count+1
				if(count>10){break}
			}
		}
	}
	else // follow redirects
	{
	}
//	console.log(urlplus)
	
	let torrent_parse=function(url) {
		return new Promise(function(resolve, reject) {
			remote(url, { timeout: 60 * 1000 , followRedirects: true }, function(err, parsedTorrent){
				if (err) { reject(err) }
				resolve(parsedTorrent)
			})
		})
	}
	let data=await torrent_parse(urlplus) // does not work with magnets?

	let client
	let torrent_magnet_add=async function(url) {
		return new Promise(function(resolve, reject)
		{
			client = new WebTorrent()
			client.on('error', function(err){ if(!client.destroyed){client.destroy()} ; reject(err) })
			// download to memory using memchunks
			let torrent=client.add(url, {store:memchunks} , function(torrent){
				resolve(torrent)
			})
			torrent.on('error', function(err){ if(!client.destroyed){client.destroy()} ; reject(err) })
			torrent.on('noPeers', function(err){ if(!client.destroyed){client.destroy()} ; reject(err) })
/*
			for(let n of [
				"infoHash" , "metadata" , "ready" , "warning" ,
				"error" , "done" , "download" , "upload" ,
				"wire" , "noPeers" , "verified"
			])
			{
				torrent.on(n, function(d){ console.log(n,d) })
			}
*/
		})
	}
	
	if(!data.files) // need to magnet?
	{
		data.files=[]
//		console.log(data)

		let timeout_id
		let torrent=await Promise.race([
			torrent_magnet_add(urlplus),
			new Promise(function(_, reject){ timeout_id=setTimeout(function(){reject("timeout")}, 10*1000) } ),
		])
		if(timeout_id) { clearTimeout(timeout_id) }
		
		if(torrent)
		{
			data.length=torrent.length
	//		console.log(data.files)
			for( let ff of torrent.files )
			{
				let f={}
				f.name=ff.name
				f.length=ff.length
				data.files.push(f)
			}
			torrent.destroy()
		}
		if(client)
		{
			if(!client.destroyed){client.destroy()}
			client=undefined
		}
	}

	if(data)
	{
		await torrents.set({url:url,data:data})
	}
	return data
}


torrents.prepare=function(torrent)
{
	return torrent
}

// fill in the torrent part of an item
torrents.fill_torrent=async function(item)
{	
	let torrent_name
	
	if(!torrent_name){
		try{
			torrent_name=item.rss["/enclosure"][0]["@url"]
		}catch(e){}
	}

	if(!torrent_name){
		try{
			torrent_name=item.rss["/link"]			
		}catch(e){}
	}

// hax archive.org to torrents
	if(torrent_name)
	{
		let aa=torrent_name.split("https://archive.org/download/")
		if(aa[1])
		{
			let name=aa[1].split("/")[0]
			if(name)
			{
				torrent_name="https://archive.org/download/"+name+"/"+name+"_archive.torrent"
			}
		}
	}



	try{

		item.torrent={fail:true}
		let torrent=await torrents.fetch(torrent_name) // should work with magnets
		
		if( torrent ) // did we get something
		{
			item.torrent={fail:true}
						
			for(let file of torrent.files)
			{
				let pct=Math.floor(100*file.length/torrent.length)
				if(pct>75) // torrent must be mostly this one file
				{
					item.torrent={
						torrent_name:torrent_name,
						torrent_length:torrent.length,
						file_name:file.name,
						file_length:file.length
					}
					break
				}
			}
		}

	}catch(e){console.log(e)}


	return item
}

