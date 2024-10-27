

let hoard={}
export default hoard



import      db        from "./db.js"



// make sure we have a cache of the page available, no matter how old
hoard.first_text=async function(url)
{
	if( ! await db.get("hoard",url) ) // if not exist
	{
		return await hoard.fetch_text(url) // make exist
	}
}

hoard.fast_text=async function(url)
{
	let it
	it=await db.get("hoard",url)
	if(it)
	{
		let randage=it.randage||0	// make updates have a random interval
		if( ( Date.now() - (new Date(it.date)).getTime() ) < ( hoard.maxage + randage ) ) // use cache ?
		{
			return it.text // no refresh
		}
		hoard.fetch_text(url,true) // refresh
		return it.text // but return fast
	}
	else
	{
		return await hoard.fetch_text(url)
	}
}

// cache lasts from maxage to double maxage as a random thingy
hoard.maxage=15*60*1000

hoard.maxsize=2*1024

hoard.fetch_text=async function(url,refresh)
{
//	let corsurl=(arss.cors||"")+url
	let corsurl=url
	let oldtext
	let it
	if(!refresh) { it=await db.get("hoard",url) } // try cache
	if(it)
	{
		let randage=it.randage||0	// make updates have a random interval
		if( ( Date.now() - (new Date(it.date)).getTime() ) < ( hoard.maxage + randage ) ) // use cache ?
		{
			return it.text
		}
		oldtext=it.text
	}
	let write=async function()
	{
		it={}
		it.status=0
		it.date=new Date()
		try{

			let timeout_id
			let res=await Promise.race([
				fetch(corsurl),
				new Promise(function(_, reject){ timeout_id=setTimeout(function(){reject("timeout")}, 10*1000) } ),
			])
			if(timeout_id) { clearTimeout(timeout_id) }

			it.status=res.status
			it.text=await res.text()
			
			if(it.text=="undefined") { it.text="STATUS : "+it.status }
			it.randage=Math.floor(Math.random() * hoard.maxage);
			await db.set("hoard",url,it) // always write if we get here, errors will not write

		}catch(e){console.error("failed url",url);console.error(e)}
	}
	await write()
	return it.text
}

