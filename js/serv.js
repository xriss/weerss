
const serv={}
export default serv

import express from 'express'

serv.start=function()
{

    const app = express()
    const port = 3000

    app.get('/', (req, res) => {
        res.send('Hello World!')
    })

    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`)
    })

}
