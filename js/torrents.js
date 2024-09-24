

let torrents={}
export default torrents


import      db        from "./db.js"

import { remote } from 'parse-torrent'




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
	
	let torrent_parse=function(torrent) {
		return new Promise(function(resolve, reject) {
			remote(torrent, { timeout: 60 * 1000 }, function(err, parsedTorrent){
				if (err) { reject(err) }
				resolve(parsedTorrent)
			})
		})
	}
	let data=await torrent_parse(url) // should work with magnets

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

