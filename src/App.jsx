import { useState } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [spotifyData, setSpotifyData] = useState(null)
  const [rawStreamData, setRawStreamData] = useState(null)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [dateRange, setDateRange] = useState({ start: null, end: null })
  const [customDateStart, setCustomDateStart] = useState('')
  const [customDateEnd, setCustomDateEnd] = useState('')
  const [showCustomDropdown, setShowCustomDropdown] = useState(false)

  const formatTime = (ms) => {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    return `${hours}h ${minutes}m`
  }

  const formatDateEuropean = (date) => {
    if (!date) return ''
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const getSpotifyUrl = (uri) => {
    if (!uri) return null
    // Convert spotify:track:XXXXX to https://open.spotify.com/track/XXXXX
    const parts = uri.split(':')
    if (parts.length >= 3) {
      const type = parts[1] // track, artist, album, etc.
      const id = parts[2]
      return `https://open.spotify.com/${type}/${id}`
    }
    return null
  }

  const processRawSpotifyData = (rawDataArrays, startDate = null, endDate = null) => {
    // Combine all arrays into one
    let allStreams = rawDataArrays.flat()

    // Filter by date if provided
    if (startDate || endDate) {
      allStreams = allStreams.filter(stream => {
        const streamDate = new Date(stream.ts || stream.endTime || stream.timestamp)
        if (isNaN(streamDate.getTime())) return false

        if (startDate && streamDate < startDate) return false
        if (endDate && streamDate > endDate) return false
        return true
      })
    }

    // Calculate statistics
    const artistStats = {}
    const songStats = {}
    const albumStats = {}
    let totalPlaytimeMs = 0

    allStreams.forEach(stream => {
      const artistName = stream.master_metadata_album_artist_name || stream.artistName || 'Unknown Artist'
      const trackName = stream.master_metadata_track_name || stream.trackName || 'Unknown Track'
      const albumName = stream.master_metadata_album_album_name || stream.albumName || 'Unknown Album'
      const playTimeMs = stream.ms_played || 0

      // Extract Spotify URIs
      const trackUri = stream.spotify_track_uri || stream.track_uri || null
      const artistUri = stream.spotify_artist_uri || stream.artist_uri || null
      const albumUri = stream.spotify_album_uri || stream.album_uri || null

      totalPlaytimeMs += playTimeMs

      // Artist stats
      if (!artistStats[artistName]) {
        artistStats[artistName] = {
          name: artistName,
          playtime_ms: 0,
          play_count: 0,
          spotify_uri: artistUri
        }
      }
      artistStats[artistName].playtime_ms += playTimeMs
      artistStats[artistName].play_count += 1
      if (artistUri && !artistStats[artistName].spotify_uri) {
        artistStats[artistName].spotify_uri = artistUri
      }

      // Song stats
      const songKey = `${trackName} - ${artistName}`
      if (!songStats[songKey]) {
        songStats[songKey] = {
          name: songKey,
          playtime_ms: 0,
          play_count: 0,
          spotify_uri: trackUri,
          track_name: trackName,
          artist_name: artistName
        }
      }
      songStats[songKey].playtime_ms += playTimeMs
      songStats[songKey].play_count += 1
      if (trackUri && !songStats[songKey].spotify_uri) {
        songStats[songKey].spotify_uri = trackUri
      }

      // Album stats
      const albumKey = `${albumName} - ${artistName}`
      if (!albumStats[albumKey]) {
        albumStats[albumKey] = {
          name: albumKey,
          playtime_ms: 0,
          play_count: 0,
          spotify_uri: albumUri,
          album_name: albumName,
          artist_name: artistName
        }
      }
      albumStats[albumKey].playtime_ms += playTimeMs
      albumStats[albumKey].play_count += 1
      if (albumUri && !albumStats[albumKey].spotify_uri) {
        albumStats[albumKey].spotify_uri = albumUri
      }
    })

    // Convert to arrays and sort by play count
    const topArtists = Object.values(artistStats)
      .sort((a, b) => b.play_count - a.play_count)
      .map(artist => ({
        ...artist,
        playtime_minutes: Math.floor(artist.playtime_ms / 60000)
      }))

    const topSongs = Object.values(songStats)
      .sort((a, b) => b.play_count - a.play_count)
      .map(song => ({
        ...song,
        playtime_minutes: Math.floor(song.playtime_ms / 60000)
      }))

    const topAlbums = Object.values(albumStats)
      .sort((a, b) => b.play_count - a.play_count)
      .map(album => ({
        ...album,
        playtime_minutes: Math.floor(album.playtime_ms / 60000)
      }))

    return {
      year: new Date().getFullYear(),
      total_streams: allStreams.length,
      unique_songs: Object.keys(songStats).length,
      unique_artists: Object.keys(artistStats).length,
      unique_albums: Object.keys(albumStats).length,
      total_playtime_ms: totalPlaytimeMs,
      total_minutes: Math.floor(totalPlaytimeMs / 60000),
      total_hours: Math.floor(totalPlaytimeMs / 3600000),
      top_artists: topArtists,
      top_songs: topSongs,
      top_albums: topAlbums
    }
  }

  const handleMultipleFiles = async (files) => {
    if (!files || files.length === 0) return

    setIsProcessing(true)
    setError(null)
    setUploadProgress({ current: 0, total: files.length })

    try {
      const filePromises = Array.from(files).map((file, index) => {
        return new Promise((resolve, reject) => {
          if (!file.name.endsWith('.json')) {
            reject(new Error(`${file.name} is not a JSON file`))
            return
          }

          const reader = new FileReader()
          reader.onload = (e) => {
            setUploadProgress(prev => ({ ...prev, current: index + 1 }))
            try {
              const data = JSON.parse(e.target.result)
              resolve(data)
            } catch (err) {
              reject(new Error(`Failed to parse ${file.name}`))
            }
          }
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
          reader.readAsText(file)
        })
      })

      const allData = await Promise.all(filePromises)

      // Check if data is already processed or raw
      const firstFile = allData[0]
      let processedData

      if (firstFile.top_artists && firstFile.top_songs && firstFile.top_albums) {
        // Already processed format - just use the first one
        // (assuming user uploaded the same processed file multiple times)
        processedData = firstFile
        setRawStreamData(null) // No raw data to filter
      } else if (Array.isArray(firstFile)) {
        // Raw Spotify streaming history format
        setRawStreamData(allData) // Store raw data for filtering
        processedData = processRawSpotifyData(allData)
      } else {
        setError('Invalid data format. Please upload Spotify streaming history JSON files or a processed stats file.')
        setIsProcessing(false)
        return
      }

      setSpotifyData(processedData)
      setDateRange({ start: null, end: null }) // Reset date range
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to process files. Please check the file format.')
    } finally {
      setIsProcessing(false)
      setUploadProgress({ current: 0, total: 0 })
    }
  }

  const handleFileChange = (e) => {
    const files = e.target.files
    handleMultipleFiles(files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    handleMultipleFiles(files)
  }

  const handleReset = () => {
    setSpotifyData(null)
    setRawStreamData(null)
    setError(null)
    setActiveTab('overview')
    setUploadProgress({ current: 0, total: 0 })
    setDateRange({ start: null, end: null })
    setCustomDateStart('')
    setCustomDateEnd('')
  }

  const applyDateRange = (startDate, endDate) => {
    if (!rawStreamData) {
      setError('Date filtering only works with raw streaming history data')
      return
    }

    setDateRange({ start: startDate, end: endDate })
    const filteredData = processRawSpotifyData(rawStreamData, startDate, endDate)
    setSpotifyData(filteredData)
  }

  const handlePresetRange = (preset) => {
    const now = new Date()
    let startDate, endDate

    switch (preset) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)
        break
      case 'last7days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        endDate = now
        break
      case 'last30days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
        endDate = now
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = now
        break
      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        startDate = lastMonth
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
        break
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1)
        endDate = now
        break
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1)
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
        break
      case 'allTime':
        startDate = null
        endDate = null
        break
      default:
        return
    }

    applyDateRange(startDate, endDate)
  }

  const handleCustomDateRange = () => {
    if (!customDateStart || !customDateEnd) {
      setError('Please select both start and end dates')
      return
    }

    const startDate = new Date(customDateStart)
    const endDate = new Date(customDateEnd)
    endDate.setHours(23, 59, 59)

    if (startDate > endDate) {
      setError('Start date must be before end date')
      return
    }

    setError(null)
    applyDateRange(startDate, endDate)
    setShowCustomDropdown(false)
  }

  if (!spotifyData) {
    return (
      <div className="app">
        <div className="upload-container">
          <header className="header">
            <h1 className="title">Spotify Wrapped</h1>
            <p className="subtitle">Upload your data to see your year in music</p>
          </header>

          <div
            className={`upload-area ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="upload-icon">{isProcessing ? '⏳' : '📁'}</div>
            <h2>{isProcessing ? 'Processing files...' : 'Drag & Drop your JSON files here'}</h2>
            {isProcessing && uploadProgress.total > 0 && (
              <p className="upload-progress">
                Processing file {uploadProgress.current} of {uploadProgress.total}
              </p>
            )}
            {!isProcessing && (
              <>
                <p>or</p>
                <label htmlFor="file-input" className="upload-button">
                  Choose Files
                </label>
                <input
                  id="file-input"
                  type="file"
                  accept=".json"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <p className="upload-hint">Select multiple files if you have split exports</p>
              </>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="instructions">
            <h3>How to upload your Spotify data:</h3>
            <ol>
              <li>Download your Spotify extended streaming history from Spotify</li>
              <li>Extract the JSON files (usually named Streaming_History_Audio_*.json)</li>
              <li>Upload all files at once - they will be automatically combined!</li>
              <li>Or upload a pre-processed stats JSON file</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Spotify Wrapped {spotifyData.year}</h1>
        <p className="subtitle">Your year in music</p>
        <button className="reset-button" onClick={handleReset}>
          Upload Different File
        </button>
      </header>

      {rawStreamData && (
        <div className="date-filter-container">
          <h3 className="date-filter-title">Filter by Date Range</h3>

          <div className="preset-buttons-wrapper">
            <div className="preset-buttons">
              <button onClick={() => handlePresetRange('today')} className="preset-btn">Today</button>
              <button onClick={() => handlePresetRange('yesterday')} className="preset-btn">Yesterday</button>
              <button onClick={() => handlePresetRange('last7days')} className="preset-btn">Last 7 Days</button>
              <button onClick={() => handlePresetRange('last30days')} className="preset-btn">Last 30 Days</button>
              <button onClick={() => handlePresetRange('thisMonth')} className="preset-btn">This Month</button>
              <button onClick={() => handlePresetRange('lastMonth')} className="preset-btn">Last Month</button>
              <button onClick={() => handlePresetRange('thisYear')} className="preset-btn">This Year</button>
              <button onClick={() => handlePresetRange('lastYear')} className="preset-btn">Last Year</button>
              <button
                onClick={() => handlePresetRange('allTime')}
                className={`preset-btn ${!dateRange.start && !dateRange.end ? 'active' : ''}`}
              >
                All Time
              </button>

              <div className="custom-dropdown-wrapper">
                <button
                  onClick={() => setShowCustomDropdown(!showCustomDropdown)}
                  className="preset-btn custom-range-btn"
                >
                  Custom Range {showCustomDropdown ? '▲' : '▼'}
                </button>

                {showCustomDropdown && (
                  <div className="custom-dropdown">
                    <div className="date-input-group">
                      <label htmlFor="start-date">From:</label>
                      <input
                        id="start-date"
                        type="date"
                        value={customDateStart}
                        onChange={(e) => setCustomDateStart(e.target.value)}
                      />
                    </div>
                    <div className="date-input-group">
                      <label htmlFor="end-date">To:</label>
                      <input
                        id="end-date"
                        type="date"
                        value={customDateEnd}
                        onChange={(e) => setCustomDateEnd(e.target.value)}
                      />
                    </div>
                    <button onClick={handleCustomDateRange} className="apply-custom-btn">
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {dateRange.start && dateRange.end && (
            <p className="active-range">
              Showing: {formatDateEuropean(dateRange.start)} - {formatDateEuropean(dateRange.end)}
            </p>
          )}
          {!dateRange.start && !dateRange.end && (
            <p className="active-range">Showing: All Time</p>
          )}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{spotifyData.total_streams.toLocaleString()}</div>
          <div className="stat-label">Total Streams</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{spotifyData.total_hours.toLocaleString()}</div>
          <div className="stat-label">Hours Listened</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{spotifyData.unique_artists.toLocaleString()}</div>
          <div className="stat-label">Unique Artists</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{spotifyData.unique_songs.toLocaleString()}</div>
          <div className="stat-label">Unique Songs</div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'artists' ? 'active' : ''}`}
          onClick={() => setActiveTab('artists')}
        >
          Top Artists
        </button>
        <button
          className={`tab ${activeTab === 'songs' ? 'active' : ''}`}
          onClick={() => setActiveTab('songs')}
        >
          Top Songs
        </button>
        <button
          className={`tab ${activeTab === 'albums' ? 'active' : ''}`}
          onClick={() => setActiveTab('albums')}
        >
          Top Albums
        </button>
      </div>

      <div className="content">
        {activeTab === 'overview' && (
          <div className="overview">
            <div className="section">
              <h2>Top 5 Artists</h2>
              <div className="podium">
                {spotifyData.top_artists.slice(0, 5).map((artist, index) => (
                  <div key={index} className={`podium-item rank-${index + 1}`}>
                    <div className="rank">{index + 1}</div>
                    <div className="artist-name">{artist.name}</div>
                    <div className="artist-stats">
                      {formatTime(artist.playtime_ms)} • {artist.play_count} plays
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="section">
              <h2>Top 5 Songs</h2>
              <div className="song-list">
                {spotifyData.top_songs.slice(0, 5).map((song, index) => (
                    <div key={index} className="song-item">
                      <div className="song-rank">{index + 1}</div>
                      <div className="song-info">
                        <div className="song-name">{song.name}</div>
                        <div className="song-stats">
                          {formatTime(song.playtime_ms)} • {song.play_count} plays
                        </div>
                      </div>
                      {song.spotify_uri && (
                        <a
                          href={getSpotifyUrl(song.spotify_uri)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="spotify-link"
                          title="Open in Spotify"
                        >
                          <span className="spotify-icon">▶</span>
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'artists' && (
          <div className="list-view">
            <h2>Top 50 Artists</h2>
            <div className="items-grid">
              {spotifyData.top_artists.slice(0, 50).map((artist, index) => (
                <div key={index} className="item-card">
                  <div className="item-rank">#{index + 1}</div>
                  <div className="item-name">{artist.name}</div>
                  <div className="item-stats">
                    <div>{formatTime(artist.playtime_ms)}</div>
                    <div>{artist.play_count} plays</div>
                  </div>
                  {artist.spotify_uri && (
                    <a
                      href={getSpotifyUrl(artist.spotify_uri)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="spotify-link-card"
                      title="Open in Spotify"
                    >
                      ▶
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'songs' && (
          <div className="list-view">
            <h2>Top 50 Songs</h2>
            <div className="items-grid">
              {spotifyData.top_songs.slice(0, 50).map((song, index) => (
                <div key={index} className="item-card">
                  <div className="item-rank">#{index + 1}</div>
                  <div className="item-name">{song.name}</div>
                  <div className="item-stats">
                    <div>{formatTime(song.playtime_ms)}</div>
                    <div>{song.play_count} plays</div>
                  </div>
                  {song.spotify_uri && (
                    <a
                      href={getSpotifyUrl(song.spotify_uri)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="spotify-link-card"
                      title="Open in Spotify"
                    >
                      ▶
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'albums' && (
          <div className="list-view">
            <h2>Top 50 Albums</h2>
            <div className="items-grid">
              {spotifyData.top_albums.slice(0, 50).map((album, index) => (
                <div key={index} className="item-card">
                  <div className="item-rank">#{index + 1}</div>
                  <div className="item-name">{album.name}</div>
                  <div className="item-stats">
                    <div>{formatTime(album.playtime_ms)}</div>
                    <div>{album.play_count} plays</div>
                  </div>
                  {album.spotify_uri && (
                    <a
                      href={getSpotifyUrl(album.spotify_uri)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="spotify-link-card"
                      title="Open in Spotify"
                    >
                      ▶
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
