// Global state for the match
let matchSettings = {};
let currentInningsNumber = 0;

// Run loadState() when the script is first loaded to check for a saved game.
document.addEventListener('DOMContentLoaded', () => {
    loadState();
});

// Add a single, persistent event listener to the scorecards wrapper
document.getElementById('scorecards-wrapper').addEventListener('change', handleMatchEvent);

document.getElementById('match-setup-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const numPlayers = parseInt(document.getElementById('num-players').value, 10);

    if (isNaN(numPlayers) || numPlayers <= 0) {
        alert('Please enter a valid number of players.');
        return;
    }

    // Get existing player names before clearing the list to preserve them
    const existingPlayers = getPlayersFromDOM();

    // 1. Generate Player List Tables
    const playerListWrapper = document.getElementById('player-lists-wrapper');
    playerListWrapper.innerHTML = ''; // Clear previous lists
    // Pass existing names to the generator function
    generatePlayerListTable(playerListWrapper, 'Team A', numPlayers, existingPlayers['Team A']);
    generatePlayerListTable(playerListWrapper, 'Team B', numPlayers, existingPlayers['Team B']);
    playerListWrapper.classList.remove('hidden');
    
    // 2. Show the "Start Match" button and hide old scorecards
    document.getElementById('start-match-container').classList.remove('hidden');
    document.getElementById('match-setup-form').parentElement.classList.add('hidden'); // Hide setup form
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
    saveState(); // Save state after starting the match
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
    const firstInningsWickets = scorecardsWrapper.querySelector('#bowling-total-wickets').textContent;
    matchSettings.firstInningsScore = parseInt(firstInningsRuns, 10);
    matchSettings.firstInningsWickets = parseInt(firstInningsWickets, 10);
    matchSettings.targetScore = matchSettings.firstInningsScore + 1;
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
    saveState(); // Save state after starting the second innings
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

function generatePlayerListTable(container, teamName, playerCount, existingNames = []) {
    const teamSection = document.createElement('div');
    teamSection.className = 'team-section'; // Reuse existing class for consistency
    teamSection.id = `player-list-${teamName.replace(' ', '-')}`; // Add a unique ID

    // Create the inner HTML for the player list table
    let tableRows = '';
    for (let i = 1; i <= playerCount; i++) {
        // Use the existing name if available, otherwise use a default placeholder
        const playerName = existingNames[i - 1] || `Player ${i}`;
        tableRows += `
            <tr>
                <td><input type="text" class="player-name-input" value="${playerName}" aria-label="${teamName} Player ${i} name"></td>
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
        overRow.id = `over-row-${currentInningsNumber}-${i}`; // Add a unique ID for the over's main row
        
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
        saveState(); // Save state after every ball event
        checkInningsEnd();
    } else if (e.target.classList.contains('batsman-select')) {
        // When a batsman is selected from a dropdown, update other dropdowns and enable the radio.
        handleBatsmanSelection(e.target);
    } else if (e.target.classList.contains('bowler-select')) {
        // Prompt user to select batsmen after selecting the first bowler for the innings.
        const bowlerRow = e.target.closest('tr');
        // Check if this is the first row in the bowling table's body.
        const isFirstOver = bowlerRow && bowlerRow.parentElement.rows[0] === bowlerRow;

        // Scope the query to the active scorecard wrapper to avoid finding batsmen from the 1st innings summary
        const firstBatsmanSelect = document.querySelector('#scorecards-wrapper .batsman-select');
        const isAnyBatsmanSelected = firstBatsmanSelect && firstBatsmanSelect.value !== '';

        if (isFirstOver && !isAnyBatsmanSelected) {
            alert('Bowler selected. Now, please select the two opening batsmen and choose who is on strike.');
        }
    }
}

/**
 * Dynamically adds a new ball input cell after the current one.
 * This now adds a new ROW for the extra ball, instead of a new column.
 * @param {HTMLElement} currentInputElement The input element that triggered the extra ball.
 */
function addExtraBall(currentInputElement) {
    const currentRow = currentInputElement.closest('tr');
    const tbody = currentRow.closest('tbody');

    // 1. Find the main over row.
    const mainOverRow = currentRow.classList.contains('extra-over-row') 
        ? document.getElementById(currentRow.dataset.overRow) 
        : currentRow;
    const overId = mainOverRow.id;

    // 2. Find the last existing extra row for this over.
    const allExtraRowsForOver = tbody.querySelectorAll(`tr.extra-over-row[data-over-row="${overId}"]`);
    const lastExtraRow = allExtraRowsForOver.length > 0 ? allExtraRowsForOver[allExtraRowsForOver.length - 1] : null;

    // 3. Count ball cells in the last extra row.
    const ballCellsInLastRow = lastExtraRow ? lastExtraRow.querySelectorAll('.ball-cell').length : 0;

    // 4. Decide whether to add a new row (if no extra row exists or the last one is full) or a new cell.
    if (!lastExtraRow || ballCellsInLastRow >= 6) {
        // --- CREATE A NEW ROW ---
        // Find the absolute last row for this over (could be main row or an existing extra row)
        const allRowsForThisOver = [mainOverRow, ...allExtraRowsForOver];
        const lastRowForThisOver = allRowsForThisOver[allRowsForThisOver.length - 1];

        const newRow = document.createElement('tr');
        newRow.className = 'extra-over-row';
        newRow.dataset.overRow = overId;

        // The new row starts with one ball cell. The placeholder TD will span the remaining 8 columns.
        newRow.innerHTML = `
            <td colspan="2" class="extra-ball-indent"></td>
            <td class="ball-cell"></td>
            <td colspan="8"></td>
        `;
        newRow.querySelector('.ball-cell').appendChild(createBallSelectElement('Extra ball'));
        lastRowForThisOver.after(newRow);
    } else {
        // --- ADD A CELL TO THE EXISTING LAST EXTRA ROW ---
        // Correctly select the placeholder TD at the end of the row, not the indent at the start.
        const placeholderCell = lastExtraRow.querySelector('td[colspan]:last-child');
        const newBallCell = document.createElement('td');
        newBallCell.className = 'ball-cell';
        newBallCell.appendChild(createBallSelectElement('Extra ball'));
        // Insert the new ball cell *before* the placeholder.
        lastExtraRow.insertBefore(newBallCell, placeholderCell);
        if (placeholderCell) {
            placeholderCell.colSpan -= 1;
        }
    }
}


/**
 * Calculates and updates the runs for a specific over (row-wise) and the grand total (column-wise).
 * @param {HTMLElement} inputElement The ball-input element that was changed.
 */
function updateBowlingStats(inputElement) {
    const row = inputElement.closest('tr');
    const table = row.closest('table');

    // Find the main row for this over to update its totals.
    const mainOverRow = row.classList.contains('extra-over-row')
        ? document.getElementById(row.dataset.overRow)
        : row;
    const overId = mainOverRow.id;

    // Get all ball selects for this over, across all its rows.
    const allRowsForOver = [mainOverRow, ...table.querySelectorAll(`tr[data-over-row="${overId}"]`)];
    const ballSelects = [];
    allRowsForOver.forEach(r => {
        ballSelects.push(...r.querySelectorAll('.ball-select'));
    });
    
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
    // Write the totals to the MAIN over row.
    mainOverRow.querySelector('.over-runs').textContent = overTotal;
    mainOverRow.querySelector('.over-wickets').textContent = overWickets;
    mainOverRow.querySelector('.over-extras').textContent = overExtras;

    // 2. Calculate "column-wise" total (the grand total for the innings)
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
                // Hide an option if it's selected in another dropdown,
                // but DON'T hide it if it's the currently selected value of THIS dropdown.
                // This prevents the non-striker's selection from being visually cleared when a new batsman is chosen.
                option.hidden = allSelectedPlayers.includes(option.value) && select.value !== option.value;
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
    const table = overRow.closest('table');
    
    // Find the main row for this over.
    const mainOverRow = overRow.classList.contains('extra-over-row')
        ? document.getElementById(overRow.dataset.overRow)
        : overRow;
    const overId = mainOverRow.id;

    // Get all ball selects for this over, across all its rows.
    const allRowsForOver = [mainOverRow, ...table.querySelectorAll(`tr[data-over-row="${overId}"]`)];
    const ballSelects = [];
    allRowsForOver.forEach(r => {
        ballSelects.push(...r.querySelectorAll('.ball-select'));
    });

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
        document.getElementById('post-match-actions').classList.remove('hidden');
        saveState(); // Save the final state
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
    const manOfTheMatch = findManOfTheMatch(battingStats, bowlingStats);
    
    // 4. Construct score text
    const firstInningsScoreText = `${defendingTeamName}: ${matchSettings.firstInningsScore}/${matchSettings.firstInningsWickets}`;
    const secondInningsScoreText = `${chasingTeamName}: ${secondInningsRuns}/${secondInningsWickets}`;

    // 5. Populate the summary container
    const summaryContainer = document.getElementById('match-summary-container');
    summaryContainer.innerHTML = `
        <h2>Match Summary</h2>
        <h3>${resultText}</h3>
        <div class="man-of-the-match">
            <h4>Man of the Match</h4>
            <p>${manOfTheMatch.name}</p>
        </div>
        <div class="final-scores">
            <p>${firstInningsScoreText}</p>
            <p>${secondInningsScoreText}</p>
        </div>
        <hr>
        <h4>Team A Top Performers</h4>
        <p><strong>Best Batsman:</strong> ${topScorerA.name} - ${topScorerA.runs} (4s: ${topScorerA.fours}, 6s: ${topScorerA.sixes}, SR: ${topScorerA.sr})</p>
        <p><strong>Best Bowler:</strong> ${bestBowlerA.name} - ${bestBowlerA.wickets}/${bestBowlerA.runs} (ER: ${bestBowlerA.economy.toFixed(2)})</p>
        <hr>
        <h4>Team B Top Performers</h4>
        <p><strong>Best Batsman:</strong> ${topScorerB.name} - ${topScorerB.runs} (4s: ${topScorerB.fours}, 6s: ${topScorerB.sixes}, SR: ${topScorerB.sr})</p>
        <p><strong>Best Bowler:</strong> ${bestBowlerB.name} - ${bestBowlerB.wickets}/${bestBowlerB.runs} (ER: ${bestBowlerB.economy.toFixed(2)})</p>
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

        if (name) {
            const runs = parseInt(row.querySelector('.batsman-runs').textContent, 10);
            const balls = parseInt(row.querySelector('.batsman-balls').textContent, 10);
            const fours = parseInt(row.querySelector('.batsman-fours').textContent, 10);
            const sixes = parseInt(row.querySelector('.batsman-sixes').textContent, 10);
            const sr = (balls > 0) ? ((runs / balls) * 100).toFixed(2) : '0.00';

            stats.push({ name, runs, balls, fours, sixes, sr });
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

function findManOfTheMatch(battingStats, bowlingStats) {
    const playerPoints = {};

    // Add points for runs (1 point per run)
    battingStats.forEach(player => {
        if (!playerPoints[player.name]) playerPoints[player.name] = 0;
        playerPoints[player.name] += player.runs;
    });

    // Add points for wickets (20 points per wicket)
    bowlingStats.forEach(player => {
        if (!playerPoints[player.name]) playerPoints[player.name] = 0;
        playerPoints[player.name] += player.wickets * 20;
    });

    if (Object.keys(playerPoints).length === 0) return { name: 'N/A' };

    const topPerformer = Object.keys(playerPoints).reduce((a, b) => playerPoints[a] > playerPoints[b] ? a : b);
    return { name: topPerformer };
}

function findTopScorer(battingStats) {
    if (battingStats.length === 0) return { name: 'N/A', runs: 0, fours: 0, sixes: 0, sr: '0.00' };
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

// Add new event listeners for post-match actions
document.getElementById('restart-match-btn').addEventListener('click', function() {
    // This function resets the UI to the setup screen, preserving key settings.

    // 1. Store the settings we want to keep from the completed match
    const playersToKeep = matchSettings.numPlayers;
    const oversToKeep = matchSettings.numOvers;

    // 2. Hide all in-game and post-game sections
    document.getElementById('first-innings-summary').classList.add('hidden');
    document.getElementById('scorecards-wrapper').classList.add('hidden');
    document.getElementById('second-innings-container').classList.add('hidden');
    document.getElementById('match-summary-container').classList.add('hidden');
    document.getElementById('post-match-actions').classList.add('hidden');
    document.getElementById('start-match-container').classList.add('hidden');
    document.getElementById('player-lists-wrapper').classList.add('hidden'); // Also hide player lists

    // 3. Show the initial setup form again
    document.querySelector('.setup-container').classList.remove('hidden');

    // 4. Restore the saved settings to the form inputs
    document.getElementById('num-players').value = playersToKeep || '';
    document.getElementById('num-overs').value = oversToKeep || '';

    // 5. Clear the dynamic content from the completed match
    document.getElementById('scorecards-wrapper').innerHTML = '';
    document.getElementById('first-innings-summary').innerHTML = '';
    document.getElementById('match-summary-container').innerHTML = '';

    // 6. Reset global state variables and clear localStorage for a fresh start
    matchSettings = {};
    currentInningsNumber = 0;
    clearState();

    // 7. Scroll to the top of the page to show the setup form
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

/**
 * Saves the entire application state to localStorage.
 */
function saveState() {
    const state = {
        matchSettings: matchSettings,
        currentInningsNumber: currentInningsNumber,
        scorecardsWrapperHTML: document.getElementById('scorecards-wrapper').innerHTML,
        firstInningsSummaryHTML: document.getElementById('first-innings-summary').innerHTML,
        matchSummaryHTML: document.getElementById('match-summary-container').innerHTML,
        // Save the visibility state of all major containers
        visibility: {
            setup: document.querySelector('.setup-container').classList.contains('hidden'),
            playerLists: document.getElementById('player-lists-wrapper').classList.contains('hidden'),
            startMatch: document.getElementById('start-match-container').classList.contains('hidden'),
            scorecards: document.getElementById('scorecards-wrapper').classList.contains('hidden'),
            secondInningsBtn: document.getElementById('second-innings-container').classList.contains('hidden'),
            firstInningsSummary: document.getElementById('first-innings-summary').classList.contains('hidden'),
            matchSummary: document.getElementById('match-summary-container').classList.contains('hidden'),
            postMatchActions: document.getElementById('post-match-actions').classList.contains('hidden')
        }
    };

    try {
        localStorage.setItem('cricketMatchState', JSON.stringify(state));
    } catch (e) {
        console.error("Could not save state to localStorage:", e);
    }
}

/**
 * Loads the application state from localStorage if it exists.
 */
function loadState() {
    try {
        const savedStateJSON = localStorage.getItem('cricketMatchState');
        if (!savedStateJSON) return;

        const savedState = JSON.parse(savedStateJSON);

        // Restore global variables
        matchSettings = savedState.matchSettings;
        currentInningsNumber = savedState.currentInningsNumber;

        // Restore HTML content
        document.getElementById('scorecards-wrapper').innerHTML = savedState.scorecardsWrapperHTML;
        document.getElementById('first-innings-summary').innerHTML = savedState.firstInningsSummaryHTML;
        document.getElementById('match-summary-container').innerHTML = savedState.matchSummaryHTML;

        // Restore visibility of all containers
        document.querySelector('.setup-container').classList.toggle('hidden', savedState.visibility.setup);
        document.getElementById('player-lists-wrapper').classList.toggle('hidden', savedState.visibility.playerLists);
        document.getElementById('start-match-container').classList.toggle('hidden', savedState.visibility.startMatch);
        document.getElementById('scorecards-wrapper').classList.toggle('hidden', savedState.visibility.scorecards);
        document.getElementById('second-innings-container').classList.toggle('hidden', savedState.visibility.secondInningsBtn);
        document.getElementById('first-innings-summary').classList.toggle('hidden', savedState.visibility.firstInningsSummary);
        document.getElementById('match-summary-container').classList.toggle('hidden', savedState.visibility.matchSummary);
        document.getElementById('post-match-actions').classList.toggle('hidden', savedState.visibility.postMatchActions);

    } catch (e) {
        console.error("Could not load state from localStorage:", e);
        clearState(); // Clear corrupted state
    }
}

/**
 * Clears the saved state from localStorage.
 */
function clearState() {
    localStorage.removeItem('cricketMatchState');
}
