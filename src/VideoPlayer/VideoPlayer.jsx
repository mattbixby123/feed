import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Context } from '../Context/ContextGoogle';
import { formatTime } from '../utils/formatTime';
import './VideoPlayer.scss';

function VideoPlayer({ autoplay = false }) {
    const { mediaList, currentMedia, setCurrentMedia } = useContext(Context);

    const [isPlaying, setIsPlaying] = useState(autoplay);
    const [currentVolume, setCurrentVolume] = useState(1);
    const [isMute, setIsMute] = useState(true);
    const [mediaElapsed, setMediaElapsed] = useState(0);
    const videoRef = useRef(null);
    const mediaRangeRef = useRef(null);
    const volumeRangeRef = useRef(null);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const lastHandledIndex = useRef(0);
    const mediaQueue = useRef([]);
    const isProcessingQueue = useRef(false);
    const timerRef = useRef(null);

    const [duration, setDuration] = useState([0, 0]);
    const [currentTime, setCurrentTime] = useState([0, 0]);
    const [durationSec, setDurationSec] = useState(0);

    const imageDuration = 4; // Duration for image display in seconds

    const isImageFile = (src) => {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        return src && imageExtensions.some(extension => src.toLowerCase().endsWith(extension));
    };

    const isVideoFile = (src) => {
        const videoExtensions = ['.mp4', '.webm', '.ogg'];
        return src && videoExtensions.some(extension => src.toLowerCase().endsWith(extension));
    };

    const handlePlayPause = () => {
        console.log(`PlayPause clicked. Current isPlaying: ${isPlaying}`);
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    };

    const play = async () => {
        console.log('Play function called');
        if (currentMedia) {
            if (isImageFile(currentMedia.url)) {
                playMedia();
            } else if (isVideoFile(currentMedia.url) && videoRef.current) {
                try {
                    videoRef.current.muted = isMute;
                    await videoRef.current.play();
                    playMedia();
                } catch (error) {
                    console.error("Can't play video", error);
                    handleNext();
                    return;
                }
            }
        }
    };

    const pause = () => {
        console.log('Pause function called');
        if (currentMedia) {
            if (isVideoFile(currentMedia.url) && videoRef.current) {
                videoRef.current.pause();
            }
            pauseMedia();
        }
    };

    const playMedia = () => {
        console.log('playMedia called');
        clearInterval(timerRef.current);
        if (isImageFile(currentMedia.url)) {
            timerRef.current = setInterval(() => {
                setMediaElapsed(prevElapsed => {
                    if (prevElapsed >= imageDuration) {
                        clearInterval(timerRef.current);
                        handleNext();
                        return imageDuration;
                    }
                    return prevElapsed + 1;
                });
            }, 1000);
        } else if (isVideoFile(currentMedia.url) && videoRef.current) {
            // For videos, we'll update the elapsed time every second
            timerRef.current = setInterval(() => {
                setMediaElapsed(videoRef.current.currentTime);
            }, 1000);
        }
        setIsPlaying(true);
    };

    const pauseMedia = () => {
        console.log('pauseMedia called');
        clearInterval(timerRef.current);
        setIsPlaying(false);
    };

    const stop = () => {
        console.log('Stop function called');
        // pauseMedia();
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
        }
        setMediaElapsed(0);
        setCurrentTime([0, 0]);
    };

    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    };

    const handleNext = useCallback(
        debounce(() => {
            setCurrentMediaIndex(prevIndex => {
                const nextIndex = (prevIndex + 1) % mediaList.length;
                console.log(`handleNext called. Current index: ${prevIndex}, Next index: ${nextIndex}`);
                mediaQueue.current.push(nextIndex);
                processMediaQueue();
                return nextIndex;
            });
        }, 300),
        [mediaList.length]
    );

    const handlePrev = useCallback(
        debounce(() => {
            setCurrentMediaIndex(prevIndex => {
                const nextIndex = (prevIndex - 1 + mediaList.length) % mediaList.length;
                console.log(`handlePrev called. Current index: ${prevIndex}, Next index: ${nextIndex}`);
                mediaQueue.current.push(nextIndex);
                processMediaQueue();
                return nextIndex;
            });
        }, 300),
        [mediaList.length]
    );

    const processMediaQueue = useCallback(() => {
        if (isProcessingQueue.current) return;
        isProcessingQueue.current = true;

        const processNext = () => {
            if (mediaQueue.current.length === 0) {
                isProcessingQueue.current = false;
                return;
            }

            const nextIndex = mediaQueue.current.shift();
            console.log(`Processing media index: ${nextIndex}`);
            setCurrentMedia(mediaList[nextIndex]);
            lastHandledIndex.current = nextIndex;

            // Use setTimeout to allow React to update the UI
            setTimeout(processNext, 0);
        };

        processNext();
    }, [mediaList, setCurrentMedia]);

    const handleMediaRange = (event) => {
        const value = parseFloat(event.target.value);
        console.log(`handleMediaRange called. New value: ${value}`);
        setMediaElapsed(value);
        if (isVideoFile(currentMedia.url) && videoRef.current) {
            videoRef.current.currentTime = value;
        }
        if (isPlaying) {
            playMedia();
        }
    };

    const handleFullScreen = () => {
        console.log('handleFullScreen called');
        const elem = videoRef.current;
        if (elem) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        }
    };

    const handleVolumeRange = () => {
        if (volumeRangeRef.current) {
            let volume = volumeRangeRef.current.value;
            console.log(`handleVolumeRange called. New volume: ${volume}`);
            if (videoRef.current) {
                videoRef.current.volume = volume;
                videoRef.current.muted = volume === '0';
            }
            setCurrentVolume(volume);
            setIsMute(volume === '0');
        }
    };

    const handleMute = () => {
        console.log(`handleMute called. Current isMute: ${isMute}`);
        setIsMute(!isMute);
        if (videoRef.current) {
            videoRef.current.muted = !isMute;
        }
    };

    const handleEnded = useCallback(() => {
        console.log('Media ended. Moving to next.');
        setIsPlaying(false);
        handleNext();
    }, [handleNext]);

    useEffect(() => {
        const handleLoadedData = () => {
            if (videoRef.current) {
                setDurationSec(videoRef.current.duration);
                setDuration(formatTime(videoRef.current.duration));
                console.log(`Video loaded. Duration: ${videoRef.current.duration}`);
            }
        };

        if (currentMedia) {
            if (isVideoFile(currentMedia.url) && videoRef.current) {
                videoRef.current.addEventListener('loadeddata', handleLoadedData);
                videoRef.current.addEventListener('ended', handleEnded);
                videoRef.current.muted = isMute;
            } else if (isImageFile(currentMedia.url)) {
                setDurationSec(imageDuration);
                setDuration(formatTime(imageDuration));
            }
        }

        return () => {
            clearInterval(timerRef.current);
            if (videoRef.current) {
                videoRef.current.removeEventListener('loadeddata', handleLoadedData);
                videoRef.current.removeEventListener('ended', handleEnded);
            }
        };
    }, [currentMedia, handleEnded, isMute]);

    useEffect(() => {
        if (mediaList.length > 0) {
            console.log(`useEffect [currentMediaIndex] triggered. Current index: ${currentMediaIndex}, Last handled index: ${lastHandledIndex.current}`);
            if (currentMediaIndex !== lastHandledIndex.current) {
                mediaQueue.current.push(currentMediaIndex);
                processMediaQueue();
            }
        }
    }, [currentMediaIndex, mediaList, processMediaQueue]);

    useEffect(() => {
        if (mediaList.length > 0 && !currentMedia) {
            console.log('Initial media set triggered');
            setCurrentMediaIndex(0);
            setCurrentMedia(mediaList[0]);
            lastHandledIndex.current = 0;
        }
    }, [mediaList, currentMedia, setCurrentMedia]);

    useEffect(() => {
        console.log(`Current media changed: ${JSON.stringify(currentMedia)}, Index: ${currentMediaIndex}`);
        setMediaElapsed(0);
        setCurrentTime([0, 0]);
        setIsPlaying(false);

        if (currentMedia && autoplay) {
            play();
        }
    }, [currentMedia, currentMediaIndex, autoplay]);

    if (!currentMedia) {
        return <div>Loading...</div>;
    }

    return (
        <div className="VideoPlayer">
            <div className="VideoPlayer__video-container">
                {isImageFile(currentMedia.url) ? (
                    <img className="video-image" src={currentMedia.url} alt={currentMedia.title || 'Media'} />
                ) : (
                    <video ref={videoRef} src={currentMedia.url} poster='src/assets/videos/intro.jpg' muted={isMute}></video>
                )}
                <div className="VideoPlayer__overlay">
                    <div className="VideoPlayer__info">
                        <h2>{currentMedia.title || 'Untitled'}</h2>
                        <p>{currentMedia.text || 'No description available'}</p>
                    </div>
                </div>
            </div>
            <div className="VideoPlayer__controls">
                <div className="control-group control-group-btn">
                    <button className="control-button prev" onClick={handlePrev}>
                        <i className="ri-skip-back-fill icon"></i>
                    </button>
                    <button className="control-button play-pause" onClick={handlePlayPause}>
                        <i className={`ri-${isPlaying ? 'pause' : 'play'}-fill icon`}></i>
                    </button>
                    <button className="control-button next" onClick={handleNext}>
                        <i className="ri-skip-forward-fill icon"></i>
                    </button>
                    <button className="control-button stop" onClick={stop}>
                        <i className="ri-stop-fill icon"></i>
                    </button>
                </div>
                <div className="control-group control-group-slider">
                    <input
                        type="range"
                        className="range-input"
                        ref={mediaRangeRef}
                        onChange={handleMediaRange}
                        max={durationSec}
                        value={mediaElapsed}
                        min={0}
                    />
                    <span className="time">
                        {formatTime(mediaElapsed).min}:{formatTime(mediaElapsed).sec} / 
                        {duration[0]}:{duration[1]}
                    </span>
                </div>
                <div className="control-group control-group-volume">
                    <button className="control-button volume" onClick={handleMute}>
                        <i className={`ri-volume-${isMute ? 'mute' : 'up'}-fill`}></i>
                    </button>
                    <input 
                        type="range" 
                        className='range-input' 
                        ref={volumeRangeRef} 
                        max={1} 
                        min={0} 
                        value={currentVolume} 
                        onChange={handleVolumeRange} 
                        step={0.1} 
                    />
                    <button className="control-button full-screen" onClick={handleFullScreen}>
                        <i className="ri-fullscreen-line"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default VideoPlayer;