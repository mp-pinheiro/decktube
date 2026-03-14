import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { HomePage, SearchPage, ChannelPage, WatchPage, LoginPage } from './routes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="channel/:channelId" element={<ChannelPage />} />
          <Route path="watch/:videoId" element={<WatchPage />} />
          <Route path="login" element={<LoginPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
