import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync('js/onboarding.js', 'utf8');

const cleanMethod = `    /**
     * Setup location autocomplete
     */
    setupLocationAutocomplete() {
        const input = document.getElementById('onboardingInput');
        const suggestions = document.getElementById('locationSuggestions');
        const wrapper = input?.closest('.onboarding-location-wrapper');

        if (!input || !suggestions || !wrapper) return;

        let debounceTimer;
        const hideSuggestions = () => {
            suggestions.style.display = 'none';
        };
        const queueSearch = (query, delay = 300) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                const results = await this.searchLocation(query);
                if (document.getElementById('onboardingInput') !== input) {
                    return;
                }
                this.showLocationSuggestions(results);
            }, delay);
        };

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.userData.birthLat = null;
            this.userData.birthLon = null;

            if (query.length < 2) {
                suggestions.innerHTML = '';
                hideSuggestions();
                return;
            }

            queueSearch(query);
        });

        input.addEventListener('focus', () => {
            const query = input.value.trim();
            if (query.length >= 2) {
                queueSearch(query, 0);
            }
        });

        // Close suggestions on tap outside the current location field.
        this.locationOutsideHandler = (e) => {
            const currentWrapper = document.querySelector('.onboarding-location-wrapper');
            const currentSuggestions = document.getElementById('locationSuggestions');

            if (!currentWrapper || !currentSuggestions) {
                document.removeEventListener('pointerdown', this.locationOutsideHandler);
                this.locationOutsideHandler = null;
                return;
            }

            if (!currentWrapper.contains(e.target)) {
                currentSuggestions.style.display = 'none';
            }
        };

        document.addEventListener('pointerdown', this.locationOutsideHandler);
    },

`;

const nextMethodComment = '    /**\n     * Search location using OpenStreetMap Nominatim\n     */';
const methodStart = src.lastIndexOf('    /**', src.indexOf('    setupLocationAutocomplete() {'));
const nextMethodPos = src.indexOf(nextMethodComment, src.indexOf('    setupLocationAutocomplete() {'));

if (methodStart === -1 || nextMethodPos === -1) {
    console.error('Could not find markers');
    process.exit(1);
}

const fixed = src.slice(0, methodStart) + cleanMethod + src.slice(nextMethodPos);
writeFileSync('js/onboarding.js', fixed, 'utf8');
console.log(`Done. File length before: ${src.length}, after: ${fixed.length}`);
console.log(`Removed ~${src.length - fixed.length} bytes of corrupt code`);
