/**
 * Phantoms Music — Equalizer Component
 * 10-band equalizer with presets using the Web Audio API.
 */

import { usePlayer } from '../contexts/PlayerContext';

export default function Equalizer() {
    const { eqPreset, eqPresets, eqFrequencies, eqFilters, applyEqPreset } = usePlayer();

    const currentGains = eqPresets[eqPreset]?.gains || new Array(10).fill(0);

    const handleSliderChange = (index, value) => {
        if (eqFilters[index]) {
            eqFilters[index].gain.value = value;
        }
    };

    const formatFreq = (freq) => {
        if (freq >= 1000) return `${freq / 1000}k`;
        return `${freq}`;
    };

    return (
        <div className="equalizer">
            <div className="section-header">
                <h2 className="section-title">Equalizer</h2>
            </div>

            {/* Presets Grid */}
            <div className="eq-preset-grid">
                {Object.entries(eqPresets).map(([id, preset]) => (
                    <button
                        key={id}
                        className={`eq-preset ${eqPreset === id ? 'active' : ''}`}
                        onClick={() => applyEqPreset(id)}
                    >
                        {preset.name}
                    </button>
                ))}
            </div>

            {/* Frequency Band Sliders */}
            <div className="eq-sliders">
                {eqFrequencies.map((freq, i) => {
                    const gain = currentGains[i] || 0;
                    const fillPercent = ((gain + 12) / 24) * 100; // Range -12 to +12

                    return (
                        <div className="eq-slider" key={freq}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                {gain > 0 ? `+${gain}` : gain}dB
                            </span>
                            <div className="eq-slider__track">
                                <div
                                    className="eq-slider__fill"
                                    style={{ height: `${fillPercent}%` }}
                                />
                            </div>
                            <span className="eq-slider__label">{formatFreq(freq)}</span>
                        </div>
                    );
                })}
            </div>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8 }}>
                Select a preset or play a track to activate the equalizer
            </p>
        </div>
    );
}
