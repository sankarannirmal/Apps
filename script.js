// Global state for the match
let matchSettings = {};
let currentInningsNumber = 0;

// Add a single, persistent event listener to the scorecards wrapper
document.getElementById('scorecards-wrapper').addEventListener('change', handleMatchEvent);

document.getElementById('match-setup-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const numPlayers = parseInt(document.getElementById('num-players').value, 10);

    if (isNaN(numPlayers) || numPlayers <= 0) {
        alert('Please enter a valid number of players.');
        return;
    }

    // 1. Generate Player List Tables
    const playerListWrapper = document.getElementById('player-lists-wrapper');
    playerListWrapper.innerHTML = ''; // Clear previous lists
    generatePlayerListTable(playerListWrapper, 'Team A', numPlayers);
    generatePlayerListTable(playerListWrapper, 'Team B', numPlayers);
    playerListWrapper.classList.remove('hidden');
    
    // 2. Show the "Start Match" button and hide old scorecards
    document.getElementById('start-match-container').classList.remove('hidden');
    document.getElementById('scorecards-wrapper').classList.add('hidden');
});

document.getElementById('start-match-btn').addEventListener('click', function() {
    // Populate matchSettings from the form
    matchSettings.numOvers = parseInt(document.getElementById('num-overs').value, 10);
    matchSettings.numPlayers = parseInt(document.getElementById('num-players').value, 10);
    matchSettings.firstInningsBattingTeam = document.getElementById('batting-first').value;
    currentInningsNumber = 1;

    if (isNaN(matchSettings.numOvers) || matchSettings.numOvers <= 0) {
        alert('Please enter a valid number of overs.');
        return;
    }

    const allPlayers = getPlayersFromDOM();
    matchSettings.players = allPlayers; // Store player lists for summary
    const firstInningsBowlingTeam = (matchSettings.firstInningsBattingTeam === 'Team A') ? 'Team B' : 'Team A';
    const battingTeamPlayers = allPlayers[matchSettings.firstInningsBattingTeam];
    const bowlingTeamPlayers = allPlayers[firstInningsBowlingTeam];
    
    startInnings(matchSettings.firstInningsBattingTeam, firstInningsBowlingTeam, battingTeamPlayers, bowlingTeamPlayers, matchSettings.numOvers);
    
    // Hide the setup buttons
    document.getElementById('start-match-container').classList.add('hidden');
    document.getElementById('player-lists-wrapper').classList.add('hidden');
});

document.getElementById('start-second-innings-btn').addEventListener('click', function() {
    // Hide this button
    this.parentElement.classList.add('hidden');

    const summaryContainer = document.getElementById('first-innings-summary');
    const scorecardsWrapper = document.getElementById('scorecards-wrapper');

    // **CRITICAL FIX**: Before copying, programmatically set the 'selected' attribute
    // on the currently selected option for all dropdowns. This ensures the
    // copied HTML reflects the final state of the innings.
    scorecardsWrapper.querySelectorAll('select').forEach(select => {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
            // First, remove 'selected' from any other option to be safe
            Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
            selectedOption.setAttribute('selected', 'selected');
        }
    });

    // Capture score and create a static HTML copy of the first innings scorecard
    const firstInningsRuns = scorecardsWrapper.querySelector('#bowling-grand-total').textContent;
    matchSettings.targetScore = parseInt(firstInningsRuns, 10) + 1;
    let firstInningsHTML = scorecardsWrapper.innerHTML;

    // **CRITICAL FIX**: Sanitize the copied HTML to remove all 'id' and 'name' attributes, preventing conflicts.
    firstInningsHTML = firstInningsHTML.replace(/ id="[^"]*"/g, '');
    firstInningsHTML = firstInningsHTML.replace(/ name="[^"]*"/g, '');

    // Populate the summary container with the static, ID-less copy. The inputs are already disabled.
    summaryContainer.innerHTML = `<h2>1st Innings Scorecard</h2>${firstInningsHTML}`;
    summaryContainer.classList.remove('hidden');

    // Now that the copy is made, we can safely clear the original wrapper for the 2nd innings
    scorecardsWrapper.innerHTML = '';

    // Set state for the new innings
    currentInningsNumber = 2;

    // Swap teams for the second innings
    const secondInningsBattingTeam = (matchSettings.firstInningsBattingTeam === 'Team A') ? 'Team B' : 'Team A';
    const secondInningsBowlingTeam = matchSettings.firstInningsBattingTeam;

    // Get players for the new innings
    const allPlayers = getPlayersFromDOM();
    const battingTeamPlayers = allPlayers[secondInningsBattingTeam];
    const bowlingTeamPlayers = allPlayers[secondInningsBowlingTeam];

    // Start the new innings in the now-empty scorecardsWrapper
    startInnings(secondInningsBattingTeam, secondInningsBowlingTeam, battingTeamPlayers, bowlingTeamPlayers, matchSettings.numOvers);
});

function startInnings(battingTeamName, bowlingTeamName, battingTeamPlayers, bowlingTeamPlayers, numOvers) {
    matchSettings.currentBattingTeam = battingTeamName;
    const wrapper = document.getElementById('scorecards-wrapper');
    wrapper.innerHTML = ''; // Clear previous scorecards

    const bowlingSection = document.createElement('div');
    bowlingSection.className = 'team-section';
    bowlingSection.innerHTML = `
        <h2>${bowlingTeamName} - Bowling</h2>
        <div class="scorecard-box" id="bowling-card-container"></div>
    `;
    wrapper.appendChild(bowlingSection);
    generateBowlingScorecard(document.getElementById('bowling-card-container'), numOvers, bowlingTeamPlayers); // Pass updated names

    const battingSection = document.createElement('div');
    battingSection.className = 'team-section';
    battingSection.innerHTML = `
        <h2>${battingTeamName} - Batting</h2>
        <div class="scorecard-box" id="batting-card-container"></div>
    `;
    wrapper.appendChild(battingSection);
    generateBattingScorecard(document.getElementById('batting-card-container'), battingTeamPlayers);

    // If it's the second innings, add the target display
    if (currentInningsNumber === 2) {
        const targetEl = document.createElement('div');
        targetEl.className = 'target-display';
        targetEl.textContent = `Target: ${matchSettings.targetScore}`;
        bowlingSection.prepend(targetEl);
    }

    wrapper.classList.remove('hidden');
}

function generatePlayerListTable(container, teamName, playerCount) {
    const teamSection = document.createElement('div');
    teamSection.className = 'team-section'; // Reuse existing class for consistency
    teamSection.id = `player-list-${teamName.replace(' ', '-')}`; // Add a unique ID

    // Create the inner HTML for the player list table
    let tableRows = '';
    for (let i = 1; i <= playerCount; i++) {
        tableRows += `
            <tr>
                <td><input type="text" class="player-name-input" value="Player ${i}" aria-label="${teamName} Player ${i} name"></td>
            </tr>
        `;
    }

    teamSection.innerHTML = `
        <h2>${teamName} - Player List</h2>
        <div class="scorecard-box">
            <table>
                <thead>
                    <tr>
                        <th>Player Name</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>`;
    container.appendChild(teamSection);
}

// New function to get player names from the generated player list tables
function getPlayersFromDOM() {
    const teamAPlayers = [];
    const teamBPlayers = [];

    // Get player names for Team A using its unique ID
    const teamAInputs = document.querySelectorAll('#player-list-Team-A .player-name-input');
    teamAInputs.forEach(input => {
        teamAPlayers.push(input.value.trim());
    });

    // Get player names for Team B using its unique ID
    const teamBInputs = document.querySelectorAll('#player-list-Team-B .player-name-input');
    teamBInputs.forEach(input => {
        teamBPlayers.push(input.value.trim());
    });

    return { 'Team A': teamAPlayers, 'Team B': teamBPlayers };
}

function generateBattingScorecard(container, battingTeamPlayers) {
    container.innerHTML = ''; // Clear previous table

    const table = document.createElement('table');
    table.classList.add('batting-table'); // Use a class instead of an ID for easier querying
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header
    const headerRow = document.createElement('tr');
    const headers = ['On Strike', 'Batsman', 'Status', 'Runs', 'Balls', '4s', '6s', 'SR'];
    headerRow.innerHTML = headers.map(h => `<th>${h}</th>`).join('');
    thead.appendChild(headerRow);

    table.appendChild(thead);
    table.appendChild(tbody);

    // Add a footer for the batting total
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `
        <tr>
            <td colspan="7" class="total-label">Extras</td>
            <td id="batting-extras-total" class="grand-total">0</td>
        </tr>
        <tr>
            <td colspan="7" class="total-label">Total</td>
            <td id="batting-total-score" class="grand-total">0/0</td>
        </tr>
    `;
    table.appendChild(tfoot);
    container.appendChild(table);

    // Add the two opening batsman rows
    addNewBatsmanRow(tbody, battingTeamPlayers);
    addNewBatsmanRow(tbody, battingTeamPlayers);
}

/**
 * Adds a new, empty batsman row to the batting scorecard.
 * @param {HTMLTableSectionElement} tbody The tbody of the batting table.
 * @param {string[]} allPlayers The full list of players for the batting team.
 */
function addNewBatsmanRow(tbody, allPlayers) {
    const newRow = tbody.insertRow();
    const rowId = `batsman-row-${currentInningsNumber}-${tbody.rows.length}`;
    newRow.id = rowId;

    // Get players already selected to filter them out of the new dropdown
    const selectedPlayers = Array.from(tbody.querySelectorAll('.batsman-select')).map(s => s.value);
    const availablePlayers = allPlayers.filter(p => !selectedPlayers.includes(p));

    const playerOptions = availablePlayers.map(p => `<option value="${p}">${p}</option>`).join('');

    newRow.innerHTML = `
        <td class="on-strike-cell"><input type="radio" name="on-strike" class="on-strike-radio" value="${rowId}" disabled></td>
        <td class="batsman-name-cell">
            <select class="batsman-select">
                <option value="">Select Batsman</option>
                ${playerOptions}
            </select>
        </td>
        <td class="batsman-status">Not out</td>
        <td class="batsman-runs">0</td>
        <td class="batsman-balls">0</td>
        <td class="batsman-fours">0</td>
        <td class="batsman-sixes">0</td>
        <td class="batsman-sr">0.00</td>
    `;
}

/**
 * Creates a standardized <select> element for ball-by-ball entries.
 * @param {string} ariaLabel The accessibility label for the select element.
 * @returns {HTMLSelectElement} The created select element.
 */
function createBallSelectElement(ariaLabel) {
    const select = document.createElement('select');
    select.className = 'ball-select';
    select.setAttribute('aria-label', ariaLabel);

    const options = ['', '0', '1', '2', '3', '4', '5', '6', 'Wd', 'Nb', 'W'];
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
    return select;
}

function generateBowlingScorecard(container, overCount, bowlingTeamPlayers) { // Added bowlingTeamPlayers parameter
    container.innerHTML = ''; // Clear previous table

    const table = document.createElement('table');
    table.classList.add('bowling-table'); // Use a class instead of an ID for easier querying
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header for the new over-based layout
    const headerRow = document.createElement('tr');
    const headers = ['Over', 'Bowler', '1', '2', '3', '4', '5', '6', 'Runs', 'Wickets', 'Extras'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        if (headerText === 'Bowler') {
            th.classList.add('bowler-column');
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Create a row for each over
    for (let i = 1; i <= overCount; i++) {
        const overRow = document.createElement('tr');
        
        // Over Number Cell
        const overNumCell = document.createElement('td');
        overNumCell.textContent = i;
        overRow.appendChild(overNumCell);

        // Bowler Select Cell
        const bowlerSelectTd = document.createElement('td');
        bowlerSelectTd.classList.add('bowler-column');
        const bowlerSelect = document.createElement('select');
        bowlerSelect.className = 'bowler-select'; // Add a class for styling/identification
        bowlerSelect.setAttribute('aria-label', `Bowler for over ${i}`);

        // Add a default "Select Bowler" option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Bowler';
        bowlerSelect.appendChild(defaultOption);

        // Populate with bowling team players
        bowlingTeamPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            bowlerSelect.appendChild(option);
        });
        bowlerSelectTd.appendChild(bowlerSelect);
        overRow.appendChild(bowlerSelectTd);

        // Ball Select Cells (6 of them)
        for (let j = 1; j <= 6; j++) {
            const ballCell = document.createElement('td');
            ballCell.classList.add('ball-cell');
            ballCell.appendChild(createBallSelectElement(`Over ${i} Ball ${j}`));
            overRow.appendChild(ballCell);
        }

        // Over Runs Total Cell
        const overRunsCell = document.createElement('td');
        overRunsCell.className = 'over-runs';
        overRunsCell.textContent = '0';
        overRow.appendChild(overRunsCell);

        // Over Wickets Total Cell (This was missing)
        const overWicketsCell = document.createElement('td');
        overWicketsCell.className = 'over-wickets';
        overWicketsCell.textContent = '0';
        overRow.appendChild(overWicketsCell);

        const overExtrasCell = document.createElement('td');
        overExtrasCell.className = 'over-extras';
        overExtrasCell.textContent = '0';
        overRow.appendChild(overExtrasCell);
        tbody.appendChild(overRow);
    }

    table.appendChild(thead);
    table.appendChild(tbody);

    // Create table footer for the innings total
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `
        <tr>
            <td colspan="8" class="total-label">Total</td>
            <td id="bowling-grand-total" class="grand-total">0</td>
            <td id="bowling-total-wickets" class="grand-total">0</td>
            <td id="bowling-total-extras" class="grand-total">0</td>
        </tr>
    `;
    table.appendChild(tfoot);

    container.appendChild(table);
}

/**
 * Handles all input events on the scorecards using event delegation.
 * @param {Event} e The input event object.
 */
function handleMatchEvent(e) {
    // Check if the input came from a ball-input field
    if (e.target.classList.contains('ball-select')) {
        const selectElement = e.target;
        const value = selectElement.value;

        // Add extra ball if N/W is entered and it hasn't been added for this input yet
        if ((value === 'Nb' || value === 'Wd') && !selectElement.dataset.extraAdded) {
            addExtraBall(selectElement);
            selectElement.dataset.extraAdded = 'true'; // Mark as having an extra added
        }

        // Update both scorecards
        updateBowlingStats(selectElement);
        updateBattingStats(value);
        handleStrikeRotation(value, selectElement);
        updateBattingTeamTotal(); // Update team total after every ball
        checkInningsEnd();
    } else if (e.target.classList.contains('batsman-select')) {
        // When a batsman is selected from a dropdown, update other dropdowns and enable the radio.
        handleBatsmanSelection(e.target);
    }
}

/**
 * Dynamically adds a new ball input cell after the current one.
 * @param {HTMLElement} currentInputElement The input element that triggered the extra ball.
 */
function addExtraBall(currentInputElement) {
    const currentRow = currentInputElement.closest('tr');
    const table = currentRow.closest('table');
    const tbody = table.querySelector('tbody');

    // 1. Add the new input cell to the CURRENT row
    const currentCell = currentInputElement.parentElement;
    const newCell = document.createElement('td');
    newCell.classList.add('ball-cell');
    newCell.appendChild(createBallSelectElement('Extra ball'));
    currentCell.after(newCell);

    // 2. Check if a new column needs to be added to the whole table
    const currentBallCount = currentRow.querySelectorAll('.ball-select').length;
    const headerRow = table.querySelector('thead tr');
    // The number of ball headers is total th's minus 'Over', 'Bowler', 'Runs', 'Wickets', 'Extras'
    const headerBallCount = headerRow.children.length - 5;

    if (currentBallCount > headerBallCount) {
        // A new column is needed for the entire table
        
        // a. Add new header
        const allHeaders = headerRow.children;
        const runsHeader = allHeaders[allHeaders.length - 3]; // Runs is 3rd to last
        const newTh = document.createElement('th');
        newTh.textContent = currentBallCount; // The new header number
        newTh.classList.add('ball-cell');
        headerRow.insertBefore(newTh, runsHeader);

        // b. Add a cell to all OTHER rows to keep alignment
        tbody.querySelectorAll('tr').forEach(row => {
            if (row.querySelectorAll('.ball-select').length < currentBallCount) {
                const runsCellInRow = row.querySelector('.over-runs');
                const placeholderCell = document.createElement('td');
                placeholderCell.classList.add('ball-cell');
                row.insertBefore(placeholderCell, runsCellInRow);
            }
        });

        // c. Update footer colspan
        const footerCell = table.querySelector('tfoot .total-label');
        if (footerCell) {
            footerCell.colSpan += 1;
        }
    }
}


/**
 * Calculates and updates the runs for a specific over (row-wise) and the grand total (column-wise).
 * @param {HTMLElement} inputElement The ball-input element that was changed.
 */
function updateBowlingStats(inputElement) {
    const row = inputElement.closest('tr');
    const ballSelects = row.querySelectorAll('.ball-select');
    
    // 1. Calculate row-wise total (runs in the over)
    let overTotal = 0;
    let overWickets = 0;
    let overExtras = 0;
    ballSelects.forEach(select => {
        const value = select.value;
        if (value === 'Wd' || value === 'Nb') {
            // Wides and No Balls count as 1 run for the total
            overExtras += 1;
            overTotal += 1;
        } else if (value === 'W') {
            // Wickets don't add to the run total but are counted separately
            overWickets += 1;
        } else {
            // Treat other non-numeric values (like 'Wkt') as 0 runs
            overTotal += parseInt(value, 10) || 0;
        }
    });
    row.querySelector('.over-runs').textContent = overTotal;
    row.querySelector('.over-wickets').textContent = overWickets;
    row.querySelector('.over-extras').textContent = overExtras;

    // 2. Calculate "column-wise" total (the grand total for the innings)
    const table = row.closest('table');
    const allOverRuns = table.querySelectorAll('.over-runs');
    let grandTotal = 0;
    allOverRuns.forEach(cell => {
        grandTotal += parseInt(cell.textContent, 10) || 0;
    });
    table.querySelector('#bowling-grand-total').textContent = grandTotal;

    const allOverWickets = table.querySelectorAll('.over-wickets');
    let totalWickets = 0;
    allOverWickets.forEach(cell => {
        totalWickets += parseInt(cell.textContent, 10) || 0;
    });
    table.querySelector('#bowling-total-wickets').textContent = totalWickets;

    const allOverExtras = table.querySelectorAll('.over-extras');
    let totalExtras = 0;
    allOverExtras.forEach(cell => {
        totalExtras += parseInt(cell.textContent, 10) || 0;
    });
    table.querySelector('#bowling-total-extras').textContent = totalExtras;
}

/**
 * Updates the batting scorecard based on the outcome of a ball.
 * @param {string} ballValue The value from the ball's select dropdown (e.g., '1', '4', 'W', 'Wd').
 */
function updateBattingStats(ballValue) {
    const wrapper = document.getElementById('scorecards-wrapper');
    const onStrikeRadio = wrapper.querySelector('input[name="on-strike"]:checked');
    if (!onStrikeRadio) {
        // If the event was a wicket, don't alert, as the user needs to select the next batsman.
        if (ballValue !== 'W') alert('Please select a batsman on strike.');
        return;
    }

    const batsmanRow = wrapper.querySelector(`#${onStrikeRadio.value}`);
    const runsScored = parseInt(ballValue) || 0;
    const isLegalDelivery = ballValue !== 'Wd' && ballValue !== 'Nb';

    if (isLegalDelivery) {
        // Update Balls Faced
        const ballsCell = batsmanRow.querySelector('.batsman-balls');
        ballsCell.textContent = parseInt(ballsCell.textContent) + 1;
    }

    if (ballValue === 'W') {
        const batsmanSelect = batsmanRow.querySelector('.batsman-select');

        // Handle Wicket
        batsmanRow.querySelector('.batsman-status').textContent = 'Out';
        onStrikeRadio.disabled = true;
        onStrikeRadio.checked = false;
        batsmanSelect.disabled = true;

        // Add a new batsman row if not all out
        const totalWickets = parseInt(wrapper.querySelector('#bowling-total-wickets').textContent);
        const totalPlayers = getPlayersFromDOM()[matchSettings.currentBattingTeam].length;

        if (totalWickets < totalPlayers - 1) {
            const tbody = batsmanRow.closest('tbody');
            const allPlayers = getPlayersFromDOM()[matchSettings.currentBattingTeam];
            addNewBatsmanRow(tbody, allPlayers);
            alert('Wicket! Please select the next batsman from the new row.');
        }
    } else if (ballValue !== 'Wd' && ballValue !== 'Nb') {
        // Handle Runs (for non-extra balls)
        const runsCell = batsmanRow.querySelector('.batsman-runs');
        runsCell.textContent = parseInt(runsCell.textContent) + runsScored;

        if (runsScored === 4) {
            const foursCell = batsmanRow.querySelector('.batsman-fours');
            foursCell.textContent = parseInt(foursCell.textContent) + 1;
        } else if (runsScored === 6) {
            const sixesCell = batsmanRow.querySelector('.batsman-sixes');
            sixesCell.textContent = parseInt(sixesCell.textContent) + 1;
        }
    }

    // Update Strike Rate for all batsmen
    wrapper.querySelectorAll('.batting-table tbody tr').forEach(row => {
        const runs = parseInt(row.querySelector('.batsman-runs').textContent);
        const balls = parseInt(row.querySelector('.batsman-balls').textContent);
        const srCell = row.querySelector('.batsman-sr');
        if (balls > 0) {
            srCell.textContent = ((runs / balls) * 100).toFixed(2);
        }
    });

}

/**
 * Handles the selection of a batsman from a dropdown.
 * @param {HTMLSelectElement} changedSelect The dropdown that was changed.
 */
function handleBatsmanSelection(changedSelect) {
    const wrapper = document.getElementById('scorecards-wrapper');
    const selectedValue = changedSelect.value;
    const row = changedSelect.closest('tr');
    const radio = row.querySelector('.on-strike-radio');

    // Enable the radio button only if a valid batsman is selected
    radio.disabled = !selectedValue;

    // Update all other dropdowns to remove the selected player as an option
    const allSelects = Array.from(wrapper.querySelectorAll('.batsman-select'));
    const allSelectedPlayers = allSelects.map(s => s.value).filter(Boolean);

    allSelects.forEach(select => {
        if (select !== changedSelect) {
            Array.from(select.options).forEach(option => {
                option.hidden = allSelectedPlayers.includes(option.value);
            });
        }
    });
}

/**
 * Handles all strike rotation logic based on the ball just bowled.
 * @param {string} ballValue The value of the ball (e.g., '1', 'Wd').
 * @param {HTMLSelectElement} selectElement The element that triggered the event.
 */
function handleStrikeRotation(ballValue, selectElement) {
    // 1. Rotate for odd runs
    const runsScored = parseInt(ballValue, 10);
    if (runsScored === 1 || runsScored === 3 || runsScored === 5) {
        flipStrike();
    }

    // 2. Rotate for end of over
    const overRow = selectElement.closest('tr');
    const ballSelects = overRow.querySelectorAll('.ball-select');
    let legalDeliveries = 0;
    ballSelects.forEach(select => {
        const value = select.value;
        if (value && value !== 'Wd' && value !== 'Nb') {
            legalDeliveries++;
        }
    });

    if (legalDeliveries > 0 && legalDeliveries % 6 === 0) {
        flipStrike();
    }
}

/**
 * Flips the on-strike radio button between the two active batsmen.
 */
function flipStrike() {
    const wrapper = document.getElementById('scorecards-wrapper');
    const activeRadios = Array.from(wrapper.querySelectorAll('input[name="on-strike"]:not(:disabled)'));
    const onStrikeRadio = activeRadios.find(r => r.checked);
    
    // Find the other active batsman who has been selected from the dropdown
    const offStrikeRadio = activeRadios.find(r => !r.checked && r.closest('tr').querySelector('.batsman-select')?.value !== '');

    if (onStrikeRadio && offStrikeRadio) {
        onStrikeRadio.checked = false;
        offStrikeRadio.checked = true;
    }
}

function checkInningsEnd() {
    const wrapper = document.getElementById('scorecards-wrapper');
    const bowlingTable = wrapper.querySelector('#bowling-card-container table');
    if (!bowlingTable) return;

    // Condition 1: All overs bowled
    let legalDeliveries = 0;
    bowlingTable.querySelectorAll('.ball-select').forEach(select => {
        const value = select.value;
        if (value && value !== 'Wd' && value !== 'Nb') {
            legalDeliveries++;
        }
    });
    const oversCompleted = Math.floor(legalDeliveries / 6);

    // Condition 2: All wickets fallen
    const wicketsFallen = parseInt(wrapper.querySelector('#bowling-total-wickets').textContent, 10);

    if (currentInningsNumber === 1 && (oversCompleted >= matchSettings.numOvers || wicketsFallen >= matchSettings.numPlayers - 1)) {
        document.querySelectorAll('#scorecards-wrapper select, #scorecards-wrapper input').forEach(el => el.disabled = true);
        document.getElementById('second-innings-container').classList.remove('hidden');
        alert('End of 1st Innings!');
    } else if (currentInningsNumber === 2 && (oversCompleted >= matchSettings.numOvers || wicketsFallen >= matchSettings.numPlayers - 1 || parseInt(wrapper.querySelector('#bowling-grand-total').textContent) >= matchSettings.targetScore)) {
        // End of 2nd innings / match
        document.querySelectorAll('#scorecards-wrapper select, #scorecards-wrapper input').forEach(el => el.disabled = true);
        alert('Match End!');
        generateMatchSummary();
        currentInningsNumber = 0; // Reset for a new match
    }
}

function updateBattingTeamTotal() {
    const wrapper = document.getElementById('scorecards-wrapper');
    if (!wrapper.querySelector('#bowling-grand-total')) return; // Exit if scorecard isn't generated yet

    const totalRuns = wrapper.querySelector('#bowling-grand-total').textContent;
    const totalWickets = wrapper.querySelector('#bowling-total-wickets').textContent;
    const totalExtras = wrapper.querySelector('#bowling-total-extras').textContent;

    const battingTotalCell = wrapper.querySelector('#batting-total-score');
    if (battingTotalCell) {
        battingTotalCell.textContent = `${totalRuns}/${totalWickets}`;
    }

    const extrasCell = wrapper.querySelector('#batting-extras-total');
    if (extrasCell) {
        extrasCell.textContent = totalExtras;
    }
}

function generateMatchSummary() {
    // 1. Collect all necessary stats from the DOM
    const battingStats = collectAllBattingStats();
    const bowlingStats = collectAllBowlingStats();
    const finalScoreWrapper = document.getElementById('scorecards-wrapper');
    const secondInningsRuns = parseInt(finalScoreWrapper.querySelector('#bowling-grand-total').textContent, 10);
    const secondInningsWickets = parseInt(finalScoreWrapper.querySelector('#bowling-total-wickets').textContent, 10);

    // 2. Determine the winner and construct the result text
    const chasingTeamName = (matchSettings.firstInningsBattingTeam === 'Team A') ? 'Team B' : 'Team A';
    const defendingTeamName = matchSettings.firstInningsBattingTeam;
    let resultText = '';

    if (secondInningsRuns >= matchSettings.targetScore) {
        // Chasing team won
        const wicketsInHand = matchSettings.numPlayers - 1 - secondInningsWickets;
        resultText = `${chasingTeamName} won by ${wicketsInHand} wickets.`;
    } else if (secondInningsRuns === matchSettings.targetScore - 1) {
        // Match is tied
        resultText = 'Match Tied.';
    } else {
        // Defending team won
        const runsMargin = matchSettings.targetScore - 1 - secondInningsRuns;
        resultText = `${defendingTeamName} won by ${runsMargin} runs.`;
    }

    // 3. Find top performers for each team
    const teamAPlayers = matchSettings.players['Team A'];
    const teamBPlayers = matchSettings.players['Team B'];
    const topScorerA = findTopScorer(battingStats.filter(p => teamAPlayers.includes(p.name)));
    const bestBowlerA = findBestBowler(bowlingStats.filter(p => teamAPlayers.includes(p.name)));
    const topScorerB = findTopScorer(battingStats.filter(p => teamBPlayers.includes(p.name)));
    const bestBowlerB = findBestBowler(bowlingStats.filter(p => teamBPlayers.includes(p.name)));
    
    // 4. Populate the summary container
    const summaryContainer = document.getElementById('match-summary-container');
    summaryContainer.innerHTML = `
        <h2>Match Summary</h2>
        <h3>${resultText}</h3>
        <h4>Team A Top Performers</h4>
        <p><strong>Best Batsman:</strong> ${topScorerA.name} (${topScorerA.runs} runs)</p>
        <p><strong>Best Bowler:</strong> ${bestBowlerA.name} (${bestBowlerA.wickets} wickets @ ${bestBowlerA.economy.toFixed(2)} econ)</p>
        <hr>
        <h4>Team B Top Performers</h4>
        <p><strong>Best Batsman:</strong> ${topScorerB.name} (${topScorerB.runs} runs)</p>
        <p><strong>Best Bowler:</strong> ${bestBowlerB.name} (${bestBowlerB.wickets} wickets @ ${bestBowlerB.economy.toFixed(2)} econ)</p>
    `;
    summaryContainer.classList.remove('hidden');
}

function collectAllBattingStats() {
    const stats = [];
    document.querySelectorAll('#first-innings-summary .batting-table tbody tr, #scorecards-wrapper .batting-table tbody tr').forEach(row => {
        const select = row.querySelector('.batsman-select');
        let name = '';
        if (select && select.selectedIndex > 0) {
            name = select.options[select.selectedIndex].text;
        }
        const runs = parseInt(row.querySelector('.batsman-runs').textContent, 10);

        if (name) {
            stats.push({ name, runs });
        }
    });
    return stats;
}

function collectAllBowlingStats() {
    const stats = {}; // Use object to aggregate stats per bowler
    document.querySelectorAll('#first-innings-summary .bowling-table tbody tr, #scorecards-wrapper .bowling-table tbody tr').forEach(row => {
        const select = row.querySelector('.bowler-select');
        let name = '';
        if (select && select.selectedIndex > 0) {
            name = select.options[select.selectedIndex].text;
        }

        if (!name) return;

        if (!stats[name]) {
            stats[name] = { name, wickets: 0, runs: 0, balls: 0 };
        }

        stats[name].runs += parseInt(row.querySelector('.over-runs').textContent, 10);
        stats[name].wickets += parseInt(row.querySelector('.over-wickets').textContent, 10);

        // Count legal balls
        row.querySelectorAll('.ball-select').forEach(select => {
            const value = select.value;
            if (value && value !== 'Wd' && value !== 'Nb') {
                stats[name].balls++;
            }
        });
    });
    return Object.values(stats); // Convert back to array
}

function findTopScorer(battingStats) {
    if (battingStats.length === 0) return { name: 'N/A', runs: 0 };
    return battingStats.reduce((top, player) => player.runs > top.runs ? player : top, battingStats[0]);
}

function findBestBowler(bowlingStats) {
    if (bowlingStats.length === 0) return { name: 'N/A', wickets: 0, economy: 0 };

    // Calculate economy rate for each bowler
    bowlingStats.forEach(bowler => {
        if (bowler.balls > 0) {
            bowler.economy = (bowler.runs / bowler.balls) * 6;
        } else {
            bowler.economy = 0;
        }
    });

    // Sort by wickets (desc), then by economy (asc)
    bowlingStats.sort((a, b) => {
        if (a.wickets !== b.wickets) {
            return b.wickets - a.wickets;
        }
        if (a.economy !== b.economy) {
            return a.economy - b.economy;
        }
        // If wickets and economy are the same, sort by runs conceded (asc)
        return a.runs - b.runs;
    });

    return bowlingStats[0];
}