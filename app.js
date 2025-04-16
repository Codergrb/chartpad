document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements
    const dataInput = document.getElementById('dataInput');
    const renderBtn = document.getElementById('renderBtn');
    const clearBtn = document.getElementById('clearBtn');
    const loadSampleBtn = document.getElementById('loadSampleBtn');
    const chartContainer = document.getElementById('chartContainer');
    const statusMessage = document.getElementById('statusMessage');
    const chartTypeRadios = document.querySelectorAll('input[name="chartType"]');
    const chartTitleInput = document.getElementById('chartTitle');
    const xAxisLabelInput = document.getElementById('xAxisLabel');
    const yAxisLabelInput = document.getElementById('yAxisLabel');
    const yIntervalInput = document.getElementById('yAxisInterval');
    const titleFontSizeInput = document.getElementById('titleFontSize');
    const axisFontSizeInput = document.getElementById('axisFontSize');
    const legendFontSizeInput = document.getElementById('legendFontSize');
    const chartThemeSelect = document.getElementById('chartTheme');
    const placeholderText = document.querySelector('.placeholder-text');

    //  Constants for Local Storage 
    const LS_PREFIX = 'dataVisualizer_';
    const LS_DATA_KEY = LS_PREFIX + 'data';
    const LS_CHART_TYPE_KEY = LS_PREFIX + 'chartType';
    const LS_TITLE_KEY = LS_PREFIX + 'title';
    const LS_XAXIS_KEY = LS_PREFIX + 'xAxis';
    const LS_YAXIS_KEY = LS_PREFIX + 'yAxis';
    const LS_THEME_KEY = LS_PREFIX + 'theme';

    // Sample Data
    const sampleData = `Month,Sales (Units),Support Tickets
Jan,80,35
Feb,95,42
Mar,110,38
Apr,130,55
May,125,50
Jun,140,60
Jul,155,58
Aug,150,65`;

    // Marker Styles
    const markerTypes = ["circle", "square", "triangle", "cross", "diamond"]; 
    const lineDashTypes = ["solid", "dot", "das", "dashDot", "longDash"]; 
    
    // Parse The CSV Data
    //@returns {object|null} Parsed data object { headers: [], labels: [], series: [[]] } or null on error.
  
    function parseData() {
        const text = dataInput.value.trim();
        if (!text) {
            showStatus("Error: Data input cannot be empty.", "error");
            return null;
        }

        const lines = text.split('\n')
                          .map(line => line.trim())
                          .filter(line => line.length > 0); // Remove empty lines

        if (lines.length < 2) {
            showStatus("Error: Need at least one header row and one data row.", "error");
            return null;
        }

        try {
            // Process headers - remove empty strings resulting from trailing commas
            const headers = lines[0].split(',').map(h => h.trim()).filter(h => h);
            if (headers.length < 2) {
                showStatus("Error: Need at least one header for labels and one for data.", "error");
                 return null;
            }

            const labels = [];
            const seriesData = [];
            const seriesCount = headers.length - 1;

            for (let i = 0; i < seriesCount; i++) {
                seriesData.push([]);
            }

            // Process data rows
            let skippedRowCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length > headers.length) {
                   console.warn(`Skipping row ${i + 1}: Too many columns. Expected max ${headers.length}, got ${values.length}.`);
                   skippedRowCount++;
                   continue;
                }
                if (!values[0]) {
                    console.warn(`Skipping row ${i + 1}: Missing label in the first column.`);
                    skippedRowCount++;
                    continue;
                }

                const label = values[0];
                labels.push(label);

                for (let j = 0; j < seriesCount; j++) {
                    const rawValue = values[j + 1]; 
                    const numValue = (rawValue === undefined || rawValue === '') ? null : parseFloat(rawValue);

                    seriesData[j].push({
                        label: label, 
                        y: isNaN(numValue) ? null : numValue
                    });
                }
            }

            if (labels.length === 0) {
                 showStatus("Error: No valid data rows found after parsing.", "error");
                 return null;
            }
             if (skippedRowCount > 0) {
                showStatus(`Warning: Skipped ${skippedRowCount} data row(s) due to formatting issues (check console).`, "info");
            }


            return {
                headers: headers, // [LabelHeader, Series1Header, Series2Header, ...]
                labels: labels,   // [Label1, Label2, ...]
                series: seriesData // [[{label: L1, y: V1_1}, ...], [{label: L1, y: V1_2}, ...]]
            };
        } catch (error) {
            showStatus(`Error parsing data: ${error.message}`, "error");
            console.error("Parsing Error:", error);
            return null;
        }
    }
    
    /**
      Renders the chart based on current selections and data.
      and includes markers and line styles for relevant chart types.
     */
    function renderChart() {
        clearStatus();
        hidePlaceholder();
        const parsedData = parseData();

        if (!parsedData) {
            chartContainer.innerHTML = ''; 
            showPlaceholder("Enter valid data and click 'Render Chart'");
            return;
        }

        const selectedChartType = document.querySelector('input[name="chartType"]:checked').value;
        const selectedTheme = chartThemeSelect.value;
        const chartTitle = chartTitleInput.value.trim() || "Data Visualization";
        const xAxisLabel = xAxisLabelInput.value.trim() || parsedData.headers[0] || "Category";
        const yAxisLabel = yAxisLabelInput.value.trim() || (parsedData.headers.length > 1 ? parsedData.headers.slice(1).join('/') : "Values");
        const yInterval = parseInt(yIntervalInput.value.trim());
        const titleFontSize = parseInt(titleFontSizeInput.value.trim());
        const axisFontSize = parseInt(axisFontSizeInput.value.trim());
        const legendFontSize = parseInt(legendFontSizeInput.value.trim());
        

        // Base chart options 
        const chartOptions = {
            animationEnabled: true,
            exportEnabled: true,
            theme: selectedTheme,
            title: { text: chartTitle, fontSize: titleFontSize, padding: 20 },
            axisX: { title: xAxisLabel,titleFontSize: axisFontSize, labelAngle: -30},
            axisY: { title: yAxisLabel,titleFontSize:axisFontSize, includeZero: true, gridThickness: 0.5,interval:yInterval},
            toolTip: { shared: true },
            legend: {
                 cursor: "pointer",
                 itemclick: toggleDataSeries,
                 verticalAlign: "top",
                 horizontalAlign: "center",
                 dockInsidePlotArea: false,
                 fontSize: legendFontSize,
            },
            data: [] // Data series objects populatd later
        };

        try {
            // Handle Pie/Doughnut
            if (selectedChartType === 'pie' || selectedChartType === 'doughnut') {
                 const firstSeries = parsedData.series[0];
                 if (!firstSeries || firstSeries.length === 0) {
                      showStatus(`Error: No data found in the first series for ${selectedChartType} chart.`, "error");
                      showPlaceholder(); return;
                 }
                 const dataPoints = firstSeries.filter(dp => dp.y !== null && dp.y !== 0);
                 if (dataPoints.length === 0) {
                     showStatus(`Error: No valid (non-null, non-zero) data points found for ${selectedChartType} chart.`, "error");
                     showPlaceholder(); return;
                 }
                 chartOptions.data.push({
                    type: selectedChartType,
                    indexLabelFontColor: selectedTheme.startsWith('dark') ? "#fff" : "#000",
                    indexLabelPlacement: "auto",
                    indexLabel: "{label} ({y})",
                    showInLegend: true,
                    legendText: "{label}",
                    dataPoints: dataPoints
                 });
                 delete chartOptions.axisX; delete chartOptions.axisY;
                 delete chartOptions.toolTip; 

            } else { 
                let seriesAdded = 0;
                parsedData.series.forEach((seriesPoints, index) => {
                    const validDataPoints = seriesPoints.filter(dp => dp.y !== null);
                    if (validDataPoints.length > 0) {

                        // Base options for this series
                        const seriesOptions = {
                            type: selectedChartType,
                            name: parsedData.headers[index + 1] || `Series ${index + 1}`,
                            showInLegend: true,
                            dataPoints: validDataPoints
                        };
                        const isLineBased = (selectedChartType === 'line' || selectedChartType === 'spline' || selectedChartType === 'area');
                        if (isLineBased) {
                            const markerIndex = index % markerTypes.length;
                            seriesOptions.markerType = markerTypes[markerIndex];
                            seriesOptions.markerSize = 8; 
                            const dashIndex = index % lineDashTypes.length;
                            seriesOptions.lineDashType = lineDashTypes[dashIndex];

                            seriesOptions.lineThickness = 2; 
                        }
                         //  Add markers to column/bar for specific 
                         // if (selectedChartType === 'column' || selectedChartType === 'bar') {

                         // }


                        chartOptions.data.push(seriesOptions); 
                        seriesAdded++;
                    } else {
                         console.warn(`Series "${parsedData.headers[index + 1]}" skipped: Contains no valid numeric data points.`);
                    }
                });

                if (seriesAdded === 0) {
                     showStatus("Error: No valid data series found to plot after filtering null values.", "error");
                     showPlaceholder("No valid data to plot."); return;
                }
            }

            //  Render the chart 
            const chart = new CanvasJS.Chart(chartContainer.id, chartOptions);
            chart.render();

            if (!statusMessage.textContent.toLowerCase().includes('warning')) {
                showStatus("Chart rendered successfully!", "success");
            }
            saveStateToLocalStorage();

        } catch (error) {
            showStatus(`Error rendering chart: ${error.message}`, "error");
           // console.error("Rendering Error:", error);
            showPlaceholder("Could not render chart. ");
        }
    }


    function toggleDataSeries(e) {
        if (typeof(e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
            e.dataSeries.visible = false;
        } else {
            e.dataSeries.visible = true;
        }
        e.chart.render();
    }


    function loadSampleData() {
         dataInput.value = sampleData;
         chartTitleInput.value = "Sample Website Data"; 
         xAxisLabelInput.value = "Month";
         yAxisLabelInput.value = "Count / Units";
         showStatus("Sample data loaded. Click 'Render Chart'.", "info");
         clearChartAndPlaceholder(); 
     }


    function clearAll() {
        dataInput.value = '';
        chartTitleInput.value = '';
        xAxisLabelInput.value = '';
        yAxisLabelInput.value = '';
        chartTypeRadios[0].checked = true; 
        chartThemeSelect.selectedIndex = 0; 
        clearChartAndPlaceholder();
        clearStatus();
        showPlaceholder("Enter data and click 'Render Chart'");
        clearLocalStorage(); 
        showStatus("Inputs cleared.", "info");
     }


    function clearChartAndPlaceholder() {
        chartContainer.innerHTML = ''; 
        if (!chartContainer.querySelector('.placeholder-text')) {
            const p = document.createElement('p');
            p.className = 'placeholder-text';
            chartContainer.appendChild(p);
        }
        hidePlaceholder();
     }
     function showPlaceholder(text = "Enter data and click 'Render Chart' to visualize.") {
        const placeholder = chartContainer.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.textContent = text;
            placeholder.style.display = 'block';
        }
     }
     function hidePlaceholder() {
         const placeholder = chartContainer.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
     }



    function saveStateToLocalStorage() {
        try {
            localStorage.setItem(LS_DATA_KEY, dataInput.value);
            localStorage.setItem(LS_CHART_TYPE_KEY, document.querySelector('input[name="chartType"]:checked').value);
            localStorage.setItem(LS_THEME_KEY, chartThemeSelect.value);
            localStorage.setItem(LS_TITLE_KEY, chartTitleInput.value);
            localStorage.setItem(LS_XAXIS_KEY, xAxisLabelInput.value);
            localStorage.setItem(LS_YAXIS_KEY, yAxisLabelInput.value);
            // console.log("State saved to Local Storage."); // Optional debug log
        } catch (e) {
            console.error("Could not save state to Local Storage:", e);
            showStatus("Warning: Could not save current state. Local Storage might be full or disabled.", "error"); // More prominent warning
        }
    }
    function loadStateFromLocalStorage() {
        try {
            const savedData = localStorage.getItem(LS_DATA_KEY);
            const savedChartType = localStorage.getItem(LS_CHART_TYPE_KEY);
            const savedTheme = localStorage.getItem(LS_THEME_KEY);
            const savedTitle = localStorage.getItem(LS_TITLE_KEY);
            const savedXAxis = localStorage.getItem(LS_XAXIS_KEY);
            const savedYAxis = localStorage.getItem(LS_YAXIS_KEY);

            let stateLoaded = false;
            if (savedData) { dataInput.value = savedData; stateLoaded = true; }
            if (savedTitle) { chartTitleInput.value = savedTitle; stateLoaded = true; }
            if (savedXAxis) { xAxisLabelInput.value = savedXAxis; stateLoaded = true; }
            if (savedYAxis) { yAxisLabelInput.value = savedYAxis; stateLoaded = true; }

            if (savedChartType) {
                const radio = document.querySelector(`input[name="chartType"][value="${savedChartType}"]`);
                if (radio) { radio.checked = true; stateLoaded = true;}
            }
             if (savedTheme) {
                chartThemeSelect.value = savedTheme;
                 stateLoaded = true;
            }

            if (stateLoaded) {
                showStatus("Loaded last saved state. Click 'Render Chart' to view.", "info");
                showPlaceholder("Loaded previous data. Click 'Render Chart'."); 
            } else {
                 clearStatus(); 
                 showPlaceholder(); 
            }
        } catch (e) {
            console.error("Could not load state from Local Storage:", e);
            showStatus("Warning: Could not load previous state.", "error");
        }
    }
    function clearLocalStorage() {
         try {
            localStorage.removeItem(LS_DATA_KEY);
            localStorage.removeItem(LS_CHART_TYPE_KEY);
            localStorage.removeItem(LS_THEME_KEY);
            localStorage.removeItem(LS_TITLE_KEY);
            localStorage.removeItem(LS_XAXIS_KEY);
            localStorage.removeItem(LS_YAXIS_KEY);
            console.log("App data cleared from Local Storage.");
         } catch (e) {
              console.error("Could not clear Local Storage:", e);
         }
     }


    function showStatus(message, type = "info") {
        statusMessage.textContent = message;
        statusMessage.className = type; 
        // statusMessage.style.display = 'block'; // CSS class handles display
    }


     function clearStatus() {
         statusMessage.textContent = '';
         statusMessage.className = ''; 
         // statusMessage.style.display = 'none'; // CSS handles display:none via empty class
     }

    // Event Listeners 
    renderBtn.addEventListener('click', renderChart);
    clearBtn.addEventListener('click', clearAll);
    loadSampleBtn.addEventListener('click', loadSampleData);
    chartThemeSelect.addEventListener('change', renderChart);
    chartTypeRadios.forEach(radio => {
        radio.addEventListener('change', renderChart);
    });

    //  Initial Load 
    loadStateFromLocalStorage();

});

// coderGrb - dataVisualizer Using HTML CSS JS 
