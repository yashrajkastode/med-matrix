document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const BACKEND_URL = 'http://127.0.0.1:8000';

    // --- STATE VARIABLES ---
    let allDrugsList = [];
    let nameToKeyMap = {};
    let selectedDrugs = new Set();

    // --- DOM ELEMENTS ---
    const searchInput = document.getElementById('drug-search');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const selectedDrugsContainer = document.getElementById('selected-drugs-container');
    const checkButton = document.getElementById('check-button');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    
    // Updated/New elements
    const componentsResults = document.getElementById('components-results');
    const interactionResults = document.getElementById('interaction-results');
    const componentTitleEl = document.getElementById('component-title');
    const interactionTitleEl = document.getElementById('interaction-title');
    const resultsGrid = document.getElementById('results-grid'); // The 2-column grid wrapper

    // --- CORE FUNCTIONS ---

    /**
     * 1. Fetches all drug names from the backend on page load.
     */
    async function fetchAllDrugs() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/all_drugs`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            allDrugsList = data.all_drugs || [];
            nameToKeyMap = data.name_to_key_map || {};
        } catch (error) {
            console.error("Failed to fetch drug list:", error);
            showError("Could not connect to the backend. Please ensure it is running and refresh the page.");
        }
    }

    /**
     * 2. Renders the autocomplete suggestions based on user input. (Updated Styling)
     */
    function renderAutocomplete(filteredDrugs) {
        autocompleteResults.innerHTML = ''; // Clear old results
        if (filteredDrugs.length === 0) {
            autocompleteResults.classList.add('hidden');
            return;
        }

        autocompleteResults.classList.remove('hidden');
        filteredDrugs.slice(0, 10).forEach(drugName => {
            const div = document.createElement('div');
            // Updated light-theme styling
            div.className = 'p-3 hover:bg-blue-100 cursor-pointer text-gray-800';
            div.textContent = drugName;
            div.addEventListener('click', () => selectDrug(drugName));
            autocompleteResults.appendChild(div);
        });
    }

    /**
     * 3. Renders the selected drugs as "pills" in the container. (Updated Styling)
     */
    function renderSelectedPills() {
        selectedDrugsContainer.innerHTML = ''; // Clear old pills
        if (selectedDrugs.size === 0) {
            // Updated light-theme text
            selectedDrugsContainer.innerHTML = '<p class="text-gray-500 text-sm p-2">No medications selected.</p>';
        }

        selectedDrugs.forEach(drugName => {
            const pill = document.createElement('span');
            // New light-theme pill styling
            pill.className = 'flex items-center bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full gap-2';
            pill.textContent = drugName;
            
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '&times;';
            removeBtn.className = 'font-bold text-lg text-blue-600 hover:text-blue-900 focus:outline-none';
            removeBtn.addEventListener('click', () => removeDrug(drugName));
            
            pill.appendChild(removeBtn);
            selectedDrugsContainer.appendChild(pill);
        });

        // Enable/disable button
        checkButton.disabled = selectedDrugs.size < 2;
    }

    /**
     * 4. Renders the final results (components and interactions). (Updated)
     */
    function renderResults(data) {
        // Clear all previous results
        clearResults();

        // NEW: Show the main grid container
        resultsGrid.classList.remove('hidden');

        // 1. Render Medication Details (Brand Name, Components, Quantities)
        if (data.components && Array.isArray(data.components) && data.components.length > 0) {
            renderMedicationDetails(data.components);
        }

        // 2. Render Interactions
        if (data.interactions) {
            renderInteractions(data.interactions);
        }
    }

    /**
     * 5. Renders the "Medication Details" as an ACCORDION. (REWRITTEN)
     */
    function renderMedicationDetails(components) {
        // Clear old component details just in case
        componentsResults.innerHTML = '';
        
        components.forEach(drug => {
            // 1. Create the main wrapper for the accordion item
            const itemWrapper = document.createElement('div');
            // We'll add/remove border-b to manage open/closed rounded corners
            itemWrapper.className = 'border border-gray-200 rounded-lg'; 

            // 2. Create the Accordion Button
            const button = document.createElement('button');
            button.className = 'accordion-button w-full flex justify-between items-center p-3 bg-gray-50 text-left text-blue-700 font-semibold focus:outline-none hover:bg-gray-100 rounded-lg';
            button.innerHTML = `
                <span>${drug.brandName || drug.name}</span>
                <svg class="w-5 h-5 transition-transform transform shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            `;
            
            // 3. Create the Accordion Content (hidden by default)
            const content = document.createElement('div');
            content.className = 'accordion-content hidden p-4 border-t border-gray-200 bg-white';
            
            // --- Populate the content div ---
            // Add Brand Name (only if different from the display name)
            if (drug.brandName && drug.brandName.toLowerCase() !== drug.name.toLowerCase()) {
                const brandNameEl = document.createElement('p');
                brandNameEl.className = 'text-sm text-gray-600 mb-2';
                brandNameEl.innerHTML = `<strong>Brand Name:</strong> <span class="font-normal">${drug.brandName}</span>`;
                content.appendChild(brandNameEl);
            }

            // Add Components Title
            const componentsTitle = document.createElement('h4');
            componentsTitle.className = 'font-medium text-gray-800 mt-2';
            componentsTitle.textContent = 'Active Components:';
            content.appendChild(componentsTitle);

            // Add Components List
            const componentsList = document.createElement('ul');
            componentsList.className = 'list-disc list-inside text-gray-700 pl-2';
            
            if (drug.components && Array.isArray(drug.components) && drug.components.length > 0) {
                drug.components.forEach(component => {
                    const item = document.createElement('li');
                    item.textContent = `${component.name} (${component.quantity})`;
                    componentsList.appendChild(item);
                });
            } else {
                const item = document.createElement('li');
                item.textContent = 'Component details not available.';
                componentsList.appendChild(item);
            }
            content.appendChild(componentsList);
            // --- End content population ---

            // 4. Add Click Event Listener for Accordion logic
            button.addEventListener('click', () => {
                const isOpen = !content.classList.contains('hidden');
                
                // Close all other open items in this container
                const allContent = componentsResults.querySelectorAll('.accordion-content');
                const allArrows = componentsResults.querySelectorAll('.accordion-button svg');
                const allWrappers = componentsResults.querySelectorAll('.border'); // Get all wrappers
                const allButtons = componentsResults.querySelectorAll('.accordion-button');
                
                allContent.forEach(el => el.classList.add('hidden'));
                allArrows.forEach(svg => svg.classList.remove('rotate-180'));
                allWrappers.forEach(w => w.classList.add('rounded-lg')); // Re-round all corners
                allButtons.forEach(b => b.classList.add('rounded-lg')); // Re-round all buttons

                // Toggle this item
                if (!isOpen) {
                    content.classList.remove('hidden');
                    button.querySelector('svg').classList.add('rotate-180');
                    // Un-round the corners of the wrapper and button for a seamless look
                    itemWrapper.classList.remove('rounded-lg');
                    button.classList.remove('rounded-lg'); 
                }
            });

            // 5. Assemble the item
            itemWrapper.appendChild(button);
            itemWrapper.appendChild(content);
            componentsResults.appendChild(itemWrapper);
        });

        // Show the main "Medication Details" title
        componentTitleEl.classList.remove('hidden');
    }

    /**
     * 6. Renders the "Interaction Report".
     */
    function renderInteractions(interactions) {
        // Clear old interactions just in case
        interactionResults.innerHTML = '';

        if (interactions.length > 0) {
            // Show a WARNING, not an error.
            errorMessage.className = 'p-4 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg'; // Yellow warning
            errorMessage.textContent = `Found ${interactions.length} potential interaction(s). Please consult a professional.`;
            errorMessage.classList.remove('hidden');
            
            interactions.forEach(item => {
                const severity = item.severity.toLowerCase();
                let borderColor = 'border-gray-300';
                let textColor = 'text-gray-700';

                if (severity === 'high') {
                    borderColor = 'border-red-500';
                    textColor = 'text-red-700';
                } else if (severity === 'moderate') {
                    borderColor = 'border-yellow-500';
                    textColor = 'text-yellow-700';
                } else if (severity === 'low') {
                    borderColor = 'border-blue-500';
                    textColor = 'text-blue-700';
                }

                const card = document.createElement('div');
                card.className = `border-l-4 ${borderColor} bg-white p-4 rounded-r-lg shadow-sm border border-t-0 border-r-0 border-b-0`;
                
                card.innerHTML = `
                    <h4 class="text-lg font-bold ${textColor}">Severity: ${item.severity}</h4>
                    <p class="font-mono text-gray-600 my-2">${item.pair}</p>
                    <p class="text-gray-800">${item.effect}</p>
                `;
                interactionResults.appendChild(card);
            });
            
            // Show the main "Interaction Report" title
            interactionTitleEl.classList.remove('hidden');

        } else {
            showSuccess("No interactions found among the selected drugs based on our database.");
        }
    }


    // --- HELPER FUNCTIONS ---

    function selectDrug(drugName) {
        selectedDrugs.add(drugName);
        searchInput.value = '';
        autocompleteResults.innerHTML = '';
        autocompleteResults.classList.add('hidden');
        renderSelectedPills();
    }

    function removeDrug(drugName) {
        selectedDrugs.delete(drugName);
        renderSelectedPills();
    }

    /**
     * Clears all results and hides titles. (Updated)
     */
    function clearResults() {
        loader.classList.add('hidden');
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');
        
        // NEW: Hide the main grid
        resultsGrid.classList.add('hidden');
        
        // Clear content
        interactionResults.innerHTML = '';
        componentsResults.innerHTML = '';

        // Hide titles
        componentTitleEl.classList.add('hidden');
        interactionTitleEl.classList.add('hidden');
    }

    function showLoader() {
        clearResults();
        loader.classList.remove('hidden');
    }

    /**
     * Shows a hard error message (e.g., API down). (Updated)
     */
    function showError(message) {
        clearResults();
        // Ensure it's always red for errors
        errorMessage.className = 'p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg';
        errorMessage.textContent = message;
        errorMessage.classList.foo;
    }

    function showSuccess(message) {
        clearResults();
        successMessage.textContent = message;
        successMessage.classList.remove('hidden');
    }

    // --- EVENT LISTENERS ---

    // Handle search input
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        if (query.length === 0) {
            autocompleteResults.classList.add('hidden');
            return;
        }
        
        const filtered = allDrugsList.filter(drug => 
            drug.toLowerCase().includes(query) && !selectedDrugs.has(drug)
        );
        renderAutocomplete(filtered);
    });

    // Hide autocomplete if clicking outside
    document.addEventListener('click', (e) => {
        if (e.target !== searchInput) {
            autocompleteResults.classList.add('hidden');
        }
    });

    // Handle the main "Check" button click
    checkButton.addEventListener('click', async () => {
        if (selectedDrugs.size < 2) return;
        
        showLoader();
        
        // Convert display names back to lowercase keys for the API
        const selectedDrugKeys = Array.from(selectedDrugs).map(name => nameToKeyMap[name]);

        try {
            const response = await fetch(`${BACKEND_URL}/api/check_interactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ drugs: selectedDrugKeys }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Server error');
            }

            const data = await response.json();
            // NEW: Call the single renderResults function
            renderResults(data);

        } catch (error) {
            console.error("Failed to check interactions:", error);
            showError(error.message);
        }
    });

    // --- INITIALIZATION ---
    fetchAllDrugs(); // Load all drugs on page load
    renderSelectedPills(); // Show "No medications selected"
});