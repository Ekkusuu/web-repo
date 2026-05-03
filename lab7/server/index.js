import express from 'express'
import cors from 'cors'

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok', message: 'lab7 api scaffold ready' })
})

app.listen(port, () => {
  console.log(`lab7 api listening on http://localhost:${port}`)
})
