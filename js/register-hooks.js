
// default to just .txt
let extensions = /\.(txt)$/i;

// copy raw-loader pattern so we are in sync
import wp from "./webpack.config.cjs"
for( let it of wp && wp.module && wp.module.rules || [] )
{
	if(it.use=="raw-loader")
	{
		extensions=it.test
		break
	}
}

// hook into imports
export async function load(url, context, nextLoad)
{
	if (extensions.test(url))
	{
		let { source: source } = await nextLoad(url, { ...context , format:"module" } );
		let data=JSON.stringify(source.toString())
		source=`
const text=${data};
export default text;
`
		return {
			format: "module",
			shortCircuit: true,
			source: source
		};
	}
	return nextLoad(url);
}

