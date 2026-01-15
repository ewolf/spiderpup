const { JSDOM } = require('jsdom');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Fetch a URL and return the body
function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function runTests() {
    console.log('Fetching page from server...');

    let html;
    try {
        html = await fetch('http://localhost:5000/');
    } catch (e) {
        console.error('Error: Server not running. Start it with: perl webserver.pl');
        process.exit(1);
    }

    // Read spiderpup.js and inject it into the HTML before other scripts
    const spiderpupJs = fs.readFileSync(path.join(__dirname, 'spiderpup.js'), 'utf8');

    // Replace the external script reference with inline script
    html = html.replace(
        '<script src="spiderpup.js"></script>',
        `<script>${spiderpupJs}</script>`
    );

    // Create jsdom with the modified HTML
    const dom = new JSDOM(html, {
        runScripts: 'dangerously'
    });

    const { window } = dom;
    const { document } = window;

    // Wait for DOMContentLoaded
    await new Promise(resolve => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('DOMContentLoaded', resolve);
        }
        // Timeout fallback
        setTimeout(resolve, 100);
    });

    console.log('\n--- Test Results ---\n');

    // Test 1: Check that elements were created
    const h1 = document.querySelector('h1');
    console.log('Test 1: H1 element exists');
    console.log('  Expected: true');
    console.log('  Actual:  ', h1 !== null);
    console.log('  Content: ', h1?.textContent);

    // Test 2: Check button exists
    const button = document.querySelector('button');
    console.log('\nTest 2: Button element exists');
    console.log('  Expected: true');
    console.log('  Actual:  ', button !== null);
    console.log('  Content: ', button?.textContent);
    console.log('  Type attr:', button?.getAttribute('type'));
    console.log('  Value attr:', button?.getAttribute('value'));

    // Test 3: Check paragraph with interpolation
    const p = document.querySelector('p');
    console.log('\nTest 3: Paragraph with interpolated version');
    console.log('  Content: ', p?.textContent);

    // Test 4: Check that button click handler works
    console.log('\nTest 4: Button click handler');
    if (button && window.moduleRegistry && window.moduleRegistry.length > 0) {
        const indexModule = window.moduleRegistry.find(m => m.constructor.name === 'Index');
        if (indexModule) {
            const versionBefore = indexModule.vars.version;
            const domBefore = p?.textContent;
            console.log('  Version before click:', versionBefore);
            console.log('  DOM before click:    ', domBefore);
            button.click();
            const versionAfter = indexModule.vars.version;
            const domAfter = p?.textContent;
            console.log('  Version after click: ', versionAfter);
            console.log('  DOM after click:     ', domAfter);
            console.log('  Handler worked:', versionBefore !== versionAfter);
            console.log('  DOM updated:', domBefore !== domAfter);
        } else {
            console.log('  Could not find Index module');
        }
    } else {
        console.log('  moduleRegistry not accessible or empty');
    }

    // Test 5: Check no eval in spiderpup.js
    console.log('\nTest 5: No eval() in spiderpup.js');
    const hasEval = spiderpupJs.includes('eval(');
    console.log('  Contains eval():', hasEval);
    console.log('  PASS:', !hasEval);

    // Test 6: Conditional rendering
    console.log('\nTest 6: Conditional rendering');
    const conditionalDiv = document.querySelector('body div div');
    console.log('  Initial conditional:', conditionalDiv?.textContent);

    if (button && window.moduleRegistry) {
        const indexModule = window.moduleRegistry.find(m => m.constructor.name === 'Index');
        console.log('  Registry size:', window.moduleRegistry.length);
        console.log('  Registry contents:', window.moduleRegistry.map(m => m.constructor.name));
        console.log('  Index updatables:', indexModule?.updatables?.length);
        console.log('  Index vars:', JSON.stringify(indexModule?.vars));

        if (indexModule) {
            // Check conditions
            console.log('  Conditions:', indexModule.conditions?.length);
            if (indexModule.conditions?.[0]) {
                console.log('  Cond 0 (< 20) with 10:', indexModule.conditions[0].call(indexModule));
            }

            // Show updatables details
            console.log('  Updatables:');
            for (const u of indexModule.updatables) {
                console.log('    moduleId:', u.moduleId, 'item:', u.item?.type, 'node:', u.node?.nodeName);
            }

            // Force version to test each branch
            indexModule.set_version(10);
            console.log('  After set_version(10), vars:', JSON.stringify(indexModule.vars));
            indexModule.refresh();
            let div = document.querySelector('body div div');
            console.log('  Version 10 (SMALL):', div?.textContent);

            indexModule.set_version(50);
            indexModule.refresh();
            div = document.querySelector('body div div');
            console.log('  Version 50 (MEDIUM):', div?.textContent);

            indexModule.set_version(90);
            indexModule.refresh();
            div = document.querySelector('body div div');
            console.log('  Version 90 (LARGE):', div?.textContent);
        }
    }

    // Test 7: ComponentInstance (foo tags with color prop)
    console.log('\nTest 7: ComponentInstance (foo tags)');
    const allDivs = document.querySelectorAll('body > div');
    let fooBlueFound = false;
    let fooRedFound = false;
    for (const div of allDivs) {
        const text = div.textContent;
        if (text.includes('COLOR IS blue')) fooBlueFound = true;
        if (text.includes('COLOR IS red')) fooRedFound = true;
    }
    console.log('  Found "COLOR IS blue":', fooBlueFound);
    console.log('  Found "COLOR IS red":', fooRedFound);
    console.log('  PASS:', fooBlueFound && fooRedFound);

    // Test 8: Loop with static array items
    console.log('\nTest 8: Loop with static array [2,4,9]');
    let loopStaticFound = [false, false, false];
    for (const div of allDivs) {
        const text = div.textContent;
        if (text.includes('0 is 2')) loopStaticFound[0] = true;
        if (text.includes('1 is 4')) loopStaticFound[1] = true;
        if (text.includes('2 is 9')) loopStaticFound[2] = true;
    }
    console.log('  Found "0 is 2":', loopStaticFound[0]);
    console.log('  Found "1 is 4":', loopStaticFound[1]);
    console.log('  Found "2 is 9":', loopStaticFound[2]);
    console.log('  PASS:', loopStaticFound.every(x => x));

    // Test 9: Loop with function items (colors)
    console.log('\nTest 9: Loop with function items (colors)');
    let loopColorsFound = [false, false, false];
    for (const div of allDivs) {
        const text = div.textContent;
        if (text.includes('color 0 is red')) loopColorsFound[0] = true;
        if (text.includes('color 1 is green')) loopColorsFound[1] = true;
        if (text.includes('color 2 is blue')) loopColorsFound[2] = true;
    }
    console.log('  Found "color 0 is red":', loopColorsFound[0]);
    console.log('  Found "color 1 is green":', loopColorsFound[1]);
    console.log('  Found "color 2 is blue":', loopColorsFound[2]);
    console.log('  PASS:', loopColorsFound.every(x => x));

    // Test 10: Loop class exists in registry
    console.log('\nTest 10: Loop instances in registry');
    if (window.moduleRegistry) {
        const loops = window.moduleRegistry.filter(m => m.constructor.name === 'Loop');
        console.log('  Number of Loop instances:', loops.length);
        console.log('  PASS:', loops.length === 2);
    }

    // Test 11: ComponentInstance class exists in registry
    console.log('\nTest 11: ComponentInstance instances in registry');
    if (window.moduleRegistry) {
        const components = window.moduleRegistry.filter(m => m.constructor.name === 'ComponentInstance');
        console.log('  Number of ComponentInstance instances:', components.length);
        console.log('  PASS:', components.length === 2);
    }

    console.log('\n--- End Tests ---\n');
}

runTests().catch(console.error);
