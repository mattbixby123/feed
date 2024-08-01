import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Context } from '../Context/ContextGoogle';
import { formatTime } from '../utils/formatTime';
import './VideoPlayer.scss';

function VideoPlayer({ autoplay = false }) {
    const { mediaList, currentMedia, setCurrentMedia } = useContext(Context);

    const [isPlaying, setIsPlaying] = useState(autoplay);
    const [currentVolume, setCurrentVolume] = useState(1);
    const [isMute, setIsMute] = useState(true);  // Start muted
    const [imageElapsed, setImageElapsed] = useState(0);
    const [imageElapsedTime, setImageElapsedTime] = useState(0);
    const videoRef = useRef(null);
    const videoRangeRef = useRef(null);
    const volumeRangeRef = useRef(null);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const imageTimerRef = useRef(null);

    const [duration, setDuration] = useState([0, 0]);
    const [currentTime, setCurrentTime] = useState([0, 0]);
    const [durationSec, setDurationSec] = useState(0);
    const [currentSec, setCurrentTimeSec] = useState(0);

    const [isDropdownActive, setIsDropdownActive] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const sequenceDuration = 16; // Total duration for 4 images in sequence
    const singleImageDuration = 4; // Duration of each image
    const imageProgressMax = 1000; // Maximum value for image progress

    const isImageFile = (src) => {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        return src && imageExtensions.some(extension => src.toLowerCase().endsWith(extension));
    };

    const isVideoFile = (src) => {
        const videoExtensions = ['.mp4', '.webm', '.ogg'];
        return src && videoExtensions.some(extension => src.toLowerCase().endsWith(extension));
    };

    const isImageSequence = () => {
        return currentMediaIndex >= mediaList.length - 4;
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    };

    const play = async () => {
        if (currentMedia) {
            if (isImageSequence()) {
                playImageSequence();
                setIsPlaying(true);
            } else if (isImageFile(currentMedia.url)) {
                playStandaloneImage();
                setIsPlaying(true);
            } else if (isVideoFile(currentMedia.url) && videoRef.current) {
                try {
                    videoRef.current.muted = isMute;
                    await videoRef.current.play();
                    setIsPlaying(true);
                } catch (error) {
                    console.error("Can't play video", error);
                    handleNext();
                }
            }
        }
    };

    const pause = () => {
        if (currentMedia) {
            if (isImageSequence() || isImageFile(currentMedia.url)) {
                pauseImage();
            } else if (isVideoFile(currentMedia.url) && videoRef.current) {
                videoRef.current.pause();
            }
        }
        setIsPlaying(false);
    };

    const stop = () => {
        if (isImageSequence() || (currentMedia && isImageFile(currentMedia.url))) {
            clearInterval(imageTimerRef.current);
            setImageElapsed(0);
            setImageElapsedTime(0);
        } else if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
        setCurrentTimeSec(0);
        setCurrentTime([0, 0]);
        setIsPlaying(false);
    };

    const playImageSequence = () => {
        clearInterval(imageTimerRef.current);
        const startTime = Date.now() - imageElapsedTime * 1000;
        const timer = setInterval(() => {
            if (!isTransitioning) {
                const elapsedSecs = Math.min(Math.floor((Date.now() - startTime) / 1000), sequenceDuration);
                setImageElapsedTime(elapsedSecs);
                setImageElapsed((elapsedSecs / sequenceDuration) * imageProgressMax);
                
                if (elapsedSecs >= sequenceDuration) {
                    clearInterval(timer);
                    handleNext();
                } else if (elapsedSecs % singleImageDuration === 0 && elapsedSecs !== 0) {
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setCurrentMediaIndex(prevIndex => prevIndex + 1);
                        setIsTransitioning(false);
                    }, 50); // Short delay to simulate image loading
                }
            }
        }, 1000);
        imageTimerRef.current = timer;
    };

    const playStandaloneImage = () => {
        clearInterval(imageTimerRef.current);
        const startTime = Date.now() - imageElapsedTime * 1000;
        const timer = setInterval(() => {
            const elapsedSecs = Math.min(Math.floor((Date.now() - startTime) / 1000), singleImageDuration);
            setImageElapsedTime(elapsedSecs);
            setImageElapsed((elapsedSecs / singleImageDuration) * imageProgressMax);
            
            if (elapsedSecs >= singleImageDuration) {
                clearInterval(timer);
                handleNext();
            }
        }, 1000);
        imageTimerRef.current = timer;
    };

    const pauseImage = () => {
        clearInterval(imageTimerRef.current);
    };

    const handleNext = useCallback(() => {
        if (isImageSequence() && currentMediaIndex < mediaList.length - 1) {
            setCurrentMediaIndex(prevIndex => prevIndex + 1);
            setImageElapsedTime(prevTime => prevTime + singleImageDuration);
        } else {
            setCurrentMediaIndex((prevIndex) => (prevIndex + 1) % mediaList.length);
            setImageElapsedTime(0);
        }
    }, [currentMediaIndex, mediaList.length]);

    const handlePrev = useCallback(() => {
        if (isImageSequence() && currentMediaIndex > mediaList.length - 4) {
            setCurrentMediaIndex(prevIndex => prevIndex - 1);
            setImageElapsedTime(prevTime => Math.max(prevTime - singleImageDuration, 0));
        } else {
            setCurrentMediaIndex((prevIndex) => (prevIndex - 1 + mediaList.length) % mediaList.length);
            setImageElapsedTime(0);
        }
    }, [currentMediaIndex, mediaList.length]);

    const handleVideoRange = () => {
        if (currentMedia && isVideoFile(currentMedia.url) && videoRef.current) {
            videoRef.current.currentTime = videoRangeRef.current.value;
            setCurrentTimeSec(videoRangeRef.current.value);
        } else if (isImageSequence()) {
            const newElapsedTime = (Number(videoRangeRef.current.value) / imageProgressMax) * sequenceDuration;
            setImageElapsed(Number(videoRangeRef.current.value));
            setImageElapsedTime(newElapsedTime);
            setCurrentMediaIndex(mediaList.length - 4 + Math.floor(newElapsedTime / singleImageDuration));
        } else if (currentMedia && isImageFile(currentMedia.url)) {
            const newElapsedTime = (Number(videoRangeRef.current.value) / imageProgressMax) * singleImageDuration;
            setImageElapsed(Number(videoRangeRef.current.value));
            setImageElapsedTime(newElapsedTime);
        }
    };

    const handleFullScreen = () => {
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
            if (videoRef.current) {
                videoRef.current.volume = volume;
                videoRef.current.muted = volume === '0';
            }
            setCurrentVolume(volume);
            setIsMute(volume === '0');
        }
    };

    const handleMute = () => {
        setIsMute(!isMute);
        if (videoRef.current) {
            videoRef.current.muted = !isMute;
        }
    };

    useEffect(() => {
        let interval;
        if (isPlaying && currentMedia && isVideoFile(currentMedia.url) && videoRef.current) {
            interval = setInterval(() => {
                const { min, sec } = formatTime(videoRef.current.currentTime);
                setCurrentTimeSec(videoRef.current.currentTime);
                setCurrentTime([min, sec]);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isPlaying, currentMedia]);

    useEffect(() => {
        const handleLoadedData = () => {
            if (videoRef.current) {
                setDurationSec(videoRef.current.duration);
                const { min, sec } = formatTime(videoRef.current.duration);
                setDuration([min, sec]);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            handleNext();
        };

        if (currentMedia) {
            if (isVideoFile(currentMedia.url) && videoRef.current) {
                videoRef.current.addEventListener('loadeddata', handleLoadedData);
                videoRef.current.addEventListener('ended', handleEnded);
                videoRef.current.muted = isMute;
            }
        }

        return () => {
            clearInterval(imageTimerRef.current);
            if (videoRef.current) {
                videoRef.current.removeEventListener('loadeddata', handleLoadedData);
                videoRef.current.removeEventListener('ended', handleEnded);
            }
        };
    }, [currentMedia, handleNext, isMute]);

    useEffect(() => {
        if (mediaList.length > 0) {
            setCurrentMedia(mediaList[currentMediaIndex]);
        }
    }, [currentMediaIndex, mediaList, setCurrentMedia]);

    useEffect(() => {
        if (mediaList.length > 0 && !currentMedia) {
            setCurrentMediaIndex(0);
            setCurrentMedia(mediaList[0]);
        }
    }, [mediaList, currentMedia, setCurrentMedia]);

    useEffect(() => {
        setCurrentTimeSec(0);
        setCurrentTime([0, 0]);
        setImageElapsed(0);
        setImageElapsedTime(0);
        setIsPlaying(false);
        
        if (currentMedia && autoplay) {
            play();
        }
    }, [currentMedia, autoplay]);

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
                <div className='VideoPlayer__dropdown'>
                    <div className='VideoPlayer__select'
                    onClick={() => setIsDropdownActive(!isDropdownActive)}
                    >
                         <span>{currentMedia ? currentMedia.title : 'Select Media'}</span>
                        <div className='VideoPlayer__caret'></div>
                    </div>
                    <ul className={`VideoPlayer__menu ${isDropdownActive ? 'active' : ''}`}>
                    {mediaList.map((media, index) => (
                        <li
                            key={index}
                            className={currentMediaIndex === index ? 'active' : ''}
                            onClick={() => {
                                setCurrentMediaIndex(index);
                                setIsDropdownActive(false);
                            }}
                        >
                            {media.title || media.url}
                        </li>
                    ))}
                    </ul>
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
                    {isVideoFile(currentMedia.url) ? (
                        <>
                            <input
                                type="range"
                                className="range-input"
                                ref={videoRangeRef}
                                onChange={handleVideoRange}
                                max={durationSec}
                                value={currentSec}
                                min={0}
                            />
                            <span className="time">{currentTime[0]}:{currentTime[1]} / {duration[0]}:{duration[1]}</span>
                        </>
                    ) : (
                        <>
                            <input
                                type="range"
                                className="range-input"
                                ref={videoRangeRef}
                                onChange={handleVideoRange}
                                max={imageProgressMax}
                                value={imageElapsed}
                                min={0}
                            />
                            {isImageSequence() && (
                                <div className="image-progress-marks">
                                    <div className="mark" style={{left: '28%'}}></div>
                                    <div className="mark" style={{left: '52%'}}></div>
                                    <div className="mark" style={{left: '70%'}}></div>
                                </div>
                            )}
                            <span className="time">
                                {isTransitioning 
                                    ? `0:${Math.floor(imageElapsedTime) - 1}` 
                                    : `0:${Math.floor(imageElapsedTime)}`
                                } / 0:{isImageSequence() ? sequenceDuration : singleImageDuration}
                            </span>
                        </>
                    )}
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