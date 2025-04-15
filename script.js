// Set up the SVG dimensions
const mapContainer = d3.select("#map-container");
const width = mapContainer.node().getBoundingClientRect().width;
const height = mapContainer.node().getBoundingClientRect().height;
const margin = { top: 20, right: 20, bottom: 20, left: 20 };

// Create SVG container
const svg = d3.select("#map-container")
    .html("") // Clear the loading message
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("background-color", "#1a1a1a");

// Create a group for the map
const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Create tooltip div
const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background-color", "#2d3748")
    .style("color", "white")
    .style("padding", "10px")
    .style("border-radius", "5px")
    .style("pointer-events", "none")
    .style("z-index", "1000");

// Create the projection
const projection = d3.geoNaturalEarth1()
    .scale(width / 5.25)
    .translate([width / 2.2, height / 2])
    .precision(0.1);

console.log("Projection set up:", projection);

// Create the path generator
const path = d3.geoPath()
    .projection(projection)
    .pointRadius(2.5);  // Increased point radius by 25%

// Create a group for the points that will be on top
const pointsGroup = g.append("g")
    .attr("class", "points-group");

// Load land data first to create the mask
d3.json("data/map_data/earth.geojson").then(function(landData) {
    console.log("Loaded land data:", landData);

    // Now load the centroids data
    d3.json("data/map_data/earth_centroids.geojson").then(function(data) {
        console.log("Loaded GeoJSON data:", data);
        
        // Load bird data
        d3.json("data/map_data/bird_centroids.geojson").then(function(birdData) {
            console.log("Loaded bird data:", birdData);
            
            // Create a map of fid to bird data
            const birdMap = new Map();
            birdData.features.forEach(feature => {
                birdMap.set(feature.properties.fid.toString(), feature);
            });
            
            // Load bio data and sort by start date
            d3.json("data/map_data/bio.json").then(function(bioData) {
                console.log("Loaded bio data:", bioData);
                
                // Create a map of fid to bio entries
                const bioMap = new Map();
                bioData.features.forEach(feature => {
                    const fid = feature.fid.toString();
                    if (!bioMap.has(fid)) {
                        bioMap.set(fid, []);
                    }
                    bioMap.get(fid).push(feature);
                });
                
                // Sort each fid's entries by start date
                bioMap.forEach(entries => {
                    entries.sort((a, b) => {
                        const dateA = new Date(a.startDate);
                        const dateB = new Date(b.startDate);
                        return dateA - dateB;
                    });
                });

                // Create a flat array of all bio entries sorted by start date
                const allBioEntries = [];
                bioMap.forEach(entries => {
                    entries.forEach(entry => {
                        allBioEntries.push({
                            fid: entry.fid,
                            ...entry
                        });
                    });
                });
                allBioEntries.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

                // Function to show bird points
                function showBirdPoints() {
                    const points = pointsGroup.selectAll(".point");
                    const bioCircles = pointsGroup.selectAll(".bio-circle");
                    
                    // Hide all bio circles
                    bioCircles.style("display", "none");
                    
                    // Reset all points to default color
                    points.attr("fill", "#2d3748");
                    
                    // Group points by species count
                    const lowCountPoints = [];
                    const mediumCountPoints = [];
                    const highCountPoints = [];
                    
                    points.each(function(d) {
                        const fid = d.properties.fid.toString();
                        const birdFeature = birdMap.get(fid);
                        if (birdFeature && birdFeature.properties.has_birds === 1) {
                            const count = birdFeature.properties.species_count;
                            if (count <= 10) {
                                lowCountPoints.push(this);
                            } else if (count <= 50) {
                                mediumCountPoints.push(this);
                            } else {
                                highCountPoints.push(this);
                            }
                        }
                    });
                    
                    // Animate points in sequence
                    function animatePoints(points, color, delay) {
                        points.forEach((point, index) => {
                            setTimeout(() => {
                                d3.select(point)
                                    .attr("fill", color)
                                    .attr("r", 2);
                            }, delay + (index * 100));
                        });
                    }
                    
                    // Animate low count points first (yellow)
                    animatePoints(lowCountPoints, "#FFD700", 0);
                    
                    // Animate medium count points second (orange)
                    animatePoints(mediumCountPoints, "#FFA500", lowCountPoints.length * 100 + 500);
                    
                    // Animate high count points last (red)
                    animatePoints(highCountPoints, "#FF0000", (lowCountPoints.length + mediumCountPoints.length) * 100 + 1000);

                    // Create or update legend
                    const legend = svg.selectAll(".legend")
                        .data([1])
                        .enter()
                        .append("g")
                        .attr("class", "legend")
                        .attr("transform", `translate(${width - 200}, ${height - 120})`);

                    // Add legend title
                    legend.append("text")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("class", "text-sm font-bold fill-white")
                        .text("Bird Species Count");

                    // Add legend items
                    const legendItems = [
                        { color: "#FFD700", text: "1-10 species" },
                        { color: "#FFA500", text: "11-50 species" },
                        { color: "#FF0000", text: "50+ species" }
                    ];

                    const itemHeight = 20;
                    const itemSpacing = 25;

                    legendItems.forEach((item, i) => {
                        const itemGroup = legend.append("g")
                            .attr("transform", `translate(0, ${(i + 1) * itemSpacing})`);

                        itemGroup.append("circle")
                            .attr("cx", 0)
                            .attr("cy", 0)
                            .attr("r", 5)
                            .attr("fill", item.color);

                        itemGroup.append("text")
                            .attr("x", 15)
                            .attr("y", 4)
                            .attr("class", "text-sm fill-white")
                            .text(item.text);
                    });
                }

                // Function to show points up to a specific date
                function showPointsUpToDate(targetDate, category = null) {
                    // Remove legend when showing bio points
                    svg.selectAll(".legend").remove();
                    
                    const points = pointsGroup.selectAll(".point");
                    const bioCircles = pointsGroup.selectAll(".bio-circle");
                    
                    // Reset all points to default color
                    points.attr("fill", "#2d3748");
                    
                    // Hide all bio circles
                    bioCircles.style("display", "none");
                    
                    // If targetDate is 'all', show all points
                    if (targetDate === 'all') {
                        // Filter entries based on category if specified
                        const filteredEntries = category ? 
                            allBioEntries.filter(entry => entry.category === category) :
                            allBioEntries;

                        // Animate points sequentially
                        filteredEntries.forEach((entry, index) => {
                            setTimeout(() => {
                                const fid = entry.fid.toString();
                                points.filter(d => d.properties.fid.toString() === fid)
                                    .attr("fill", "#BC13FE");
                                
                                bioCircles.filter(d => d.properties.fid.toString() === fid)
                                    .style("display", null);
                            }, index * 500); // 500ms delay between each point
                        });
                    } else {
                        // Filter entries based on date and category
                        const filteredEntries = allBioEntries.filter(entry => {
                            if (new Date(entry.startDate) > new Date(targetDate)) return false;
                            if (category && entry.category !== category) return false;
                            return true;
                        });

                        // Animate points sequentially
                        filteredEntries.forEach((entry, index) => {
                            setTimeout(() => {
                                const fid = entry.fid.toString();
                                points.filter(d => d.properties.fid.toString() === fid)
                                    .attr("fill", "#BC13FE");
                                
                                bioCircles.filter(d => d.properties.fid.toString() === fid)
                                    .style("display", null);
                            }, index * 500); // 500ms delay between each point
                        });
                    }
                }

                // Add click handler for all nav-links
                d3.selectAll('.nav-link').on('click', function() {
                    const contentId = this.textContent.toLowerCase() + '-content';
                    const contentDiv = document.getElementById(contentId);
                    
                    // Hide all content sections
                    document.querySelectorAll('[id$="-content"]').forEach(div => {
                        div.classList.add('hidden');
                    });
                    
                    // Show the clicked section's content
                    if (contentDiv) {
                        contentDiv.classList.remove('hidden');
                    }
                    
                    // Update the map based on the section
                    if (this.textContent === 'Bio') {
                        showPointsUpToDate('all');
                    } else if (this.textContent === 'Birds') {
                        showBirdPoints();
                    } else if (this.textContent === 'Bikes') {
                        showBikePointsByDistance(); // Default to showing distance view
                    } else {
                        // For other sections, reset the map
                        resetMap();
                    }
                });

                // Add click handlers for bio filter buttons
                d3.selectAll('.bio-filter').on('click', function() {
                    const category = this.getAttribute('data-category');
                    // Remove font-bold from all buttons
                    d3.selectAll('.bio-filter').classed('font-bold', false);
                    // Add font-bold to clicked button
                    d3.select(this).classed('font-bold', true);
                    showPointsUpToDate('all', category);
                });

                // Create the points
                const points = pointsGroup.selectAll("circle")
                    .data(data.features)
                    .enter()
                    .append("circle")
                    .attr("cx", d => {
                        const [x, y] = projection(d.geometry.coordinates);
                        return x;
                    })
                    .attr("cy", d => {
                        const [x, y] = projection(d.geometry.coordinates);
                        return y;
                    })
                    .attr("r", 2)
                    .attr("fill", "#2d3748")
                    .attr("class", "point")
                    .attr("data-fid", d => d.properties.fid)
                    .on("mouseover", function(event, d) {
                        const fid = d.properties.fid.toString();
                        const entries = bioMap.get(fid) || [];
                        const birdFeature = birdMap.get(fid);
                        
                        // Make point bigger if it has birds or bio data
                        if ((birdFeature && birdFeature.properties.has_birds === 1) || entries.length > 0) {
                            d3.select(this)
                                .attr("r", 4); // 2x bigger
                        }
                        
                        let tooltipContent = "";
                        
                        if (birdFeature && birdFeature.properties.has_birds === 1) {
                            tooltipContent += `
                                <div class="mb-2">
                                    <div class="font-bold">Bird Location</div>
                                    <div class="text-sm">Species Count: ${birdFeature.properties.species_count}</div>
                                    ${birdFeature.properties.species_list ? `<div class="text-sm">Species: ${birdFeature.properties.species_list}</div>` : ''}
                                </div>
                            `;
                        }
                        
                        if (entries.length > 0) {
                            entries.forEach(entry => {
                                tooltipContent += `
                                    <div class="mb-2">
                                        <div class="font-bold">${entry.title}</div>
                                        <div class="text-sm">${entry.startDate} - ${entry.endDate}</div>
                                        <div class="text-sm">${entry.details}</div>
                                    </div>
                                `;
                            });
                        }
                        
                        if (tooltipContent) {
                            tooltip
                                .html(tooltipContent)
                                .style("left", (event.pageX + 10) + "px")
                                .style("top", (event.pageY + 10) + "px")
                                .style("opacity", 1);
                        }
                    })
                    .on("mouseout", function() {
                        // Reset point size
                        d3.select(this)
                            .attr("r", 2);
                            
                        tooltip.style("opacity", 0);
                    });

                // Add circles around points with bio data
                pointsGroup.selectAll("circle.bio-circle")
                    .data(data.features.filter(d => bioMap.has(d.properties.fid.toString())))
                    .enter()
                    .append("circle")
                    .attr("class", "bio-circle")
                    .attr("cx", d => {
                        const [x, y] = projection(d.geometry.coordinates);
                        return x;
                    })
                    .attr("cy", d => {
                        const [x, y] = projection(d.geometry.coordinates);
                        return y;
                    })
                    .attr("r", 7.5)
                    .attr("fill", "white")
                    .attr("fill-opacity", 0)
                    .attr("stroke", "#a0aec0")
                    .attr("stroke-width", 1)
                    .style("display", "none")
                    .on("mouseover", function(event, d) {
                        const fid = d.properties.fid.toString();
                        const entries = bioMap.get(fid) || [];
                        const birdFeature = birdMap.get(fid);
                        
                        // Make bio circle bigger on hover
                        d3.select(this)
                            .attr("r", 15); // 2x bigger
                        
                        let tooltipContent = "";
                        
                        if (birdFeature && birdFeature.properties.has_birds === 1) {
                            tooltipContent += `
                                <div class="mb-2">
                                    <div class="font-bold">Bird Location</div>
                                    <div class="text-sm">Species Count: ${birdFeature.properties.species_count}</div>
                                    ${birdFeature.properties.species_list ? `<div class="text-sm">Species: ${birdFeature.properties.species_list}</div>` : ''}
                                </div>
                            `;
                        }
                        
                        if (entries.length > 0) {
                            entries.forEach(entry => {
                                tooltipContent += `
                                    <div class="mb-2">
                                        <div class="font-bold">${entry.title}</div>
                                        <div class="text-sm">${entry.startDate} - ${entry.endDate}</div>
                                        <div class="text-sm">${entry.details}</div>
                                    </div>
                                `;
                            });
                        }
                        
                        if (tooltipContent) {
                            tooltip
                                .html(tooltipContent)
                                .style("left", (event.pageX + 10) + "px")
                                .style("top", (event.pageY + 10) + "px")
                                .style("opacity", 1);
                        }
                    })
                    .on("mouseout", function() {
                        // Reset bio circle size
                        d3.select(this)
                            .attr("r", 7.5);
                            
                        tooltip.style("opacity", 0);
                    });

                // Add click handlers for navigation links
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        
                        // Hide all content sections
                        document.querySelectorAll('[id$="-content"]').forEach(content => {
                            content.classList.add('hidden');
                        });
                        
                        // Show the clicked section's content
                        const sectionId = e.target.getAttribute('href').substring(1);
                        const content = document.getElementById(`${sectionId}-content`);
                        if (content) {
                            content.classList.remove('hidden');
                        }
                        
                        // Update active state
                        document.querySelectorAll('.nav-link').forEach(l => {
                            l.classList.remove('text-white', 'font-bold');
                            l.classList.add('text-gray-300');
                        });
                        e.target.classList.remove('text-gray-300');
                        e.target.classList.add('text-white', 'font-bold');

                        // Handle map data based on section
                        if (sectionId === 'birds') {
                            showBirdPoints();
                        } else {
                            // Reset to default state for other sections
                            const points = pointsGroup.selectAll(".point");
                            const bioCircles = pointsGroup.selectAll(".bio-circle");
                            points.attr("fill", "#2d3748");
                            bioCircles.style("display", "none");
                        }
                    });
                });

                // Initialize with all points hidden
                showPointsUpToDate("1900");

                // Add zoom behavior
                const zoom = d3.zoom()
                    .scaleExtent([1, 8])
                    .on("zoom", (event) => {
                        g.attr("transform", event.transform);
                    });

                svg.call(zoom);
            });
        });
    });
})
.catch(error => {
    console.error("Error loading or rendering map:", error);
    d3.select("#map-container")
        .html(`<p class='text-red-400 text-center'>Error loading map data: ${error.message}</p>`);
});

// Define bike functions globally
function showBikePointsByDistance() {
    console.log("Showing bike points by distance");
    const points = pointsGroup.selectAll(".point");
    const bioCircles = pointsGroup.selectAll(".bio-circle");
    
    // Hide all bio circles
    bioCircles.style("display", "none");
    
    // Reset all points to default color
    points.attr("fill", "#2d3748");
    
    // Group points by distance
    const lowDistancePoints = [];
    const mediumDistancePoints = [];
    const highDistancePoints = [];
    
    points.each(function(d) {
        const fid = d.properties.fid.toString();
        const bikeFeature = bikeMap ? bikeMap.get(fid) : null;
        if (bikeFeature) {
            const distance = bikeFeature.properties.distance;
            if (distance <= 50) {
                lowDistancePoints.push(this);
            } else if (distance <= 199) {
                mediumDistancePoints.push(this);
            } else {
                highDistancePoints.push(this);
            }
        }
    });
    
    // Animate points in sequence
    function animatePoints(points, color, delay) {
        points.forEach((point, index) => {
            setTimeout(() => {
                d3.select(point)
                    .attr("fill", color)
                    .attr("r", 2);
            }, delay + (index * 100));
        });
    }
    
    // Animate points with different colors
    animatePoints(lowDistancePoints, "#FFD700", 0);      // Yellow for low distance
    animatePoints(mediumDistancePoints, "#FFA500", lowDistancePoints.length * 100 + 500);  // Orange for medium
    animatePoints(highDistancePoints, "#FF0000", (lowDistancePoints.length + mediumDistancePoints.length) * 100 + 1000);  // Red for high

    // Update legend
    updateBikeLegend("distance");
}

function showBikePointsByElevation() {
    const points = pointsGroup.selectAll(".point");
    const bioCircles = pointsGroup.selectAll(".bio-circle");
    
    // Hide all bio circles
    bioCircles.style("display", "none");
    
    // Reset all points to default color
    points.attr("fill", "#2d3748");
    
    // Group points by elevation gain
    const lowElevationPoints = [];
    const mediumElevationPoints = [];
    const highElevationPoints = [];
    
    points.each(function(d) {
        const fid = d.properties.fid.toString();
        const bikeFeature = bikeMap ? bikeMap.get(fid) : null;
        if (bikeFeature) {
            const elevation = bikeFeature.properties.elevation_gain;
            if (elevation <= 100) {
                lowElevationPoints.push(this);
            } else if (elevation <= 1000) {
                mediumElevationPoints.push(this);
            } else {
                highElevationPoints.push(this);
            }
        }
    });
    
    // Animate points in sequence
    function animatePoints(points, color, delay) {
        points.forEach((point, index) => {
            setTimeout(() => {
                d3.select(point)
                    .attr("fill", color)
                    .attr("r", 2);
            }, delay + (index * 100));
        });
    }
    
    // Animate points with different colors
    animatePoints(lowElevationPoints, "#FFD700", 0);     // Yellow for low elevation
    animatePoints(mediumElevationPoints, "#FFA500", lowElevationPoints.length * 100 + 500);  // Orange for medium
    animatePoints(highElevationPoints, "#FF0000", (lowElevationPoints.length + mediumElevationPoints.length) * 100 + 1000);  // Red for high

    // Update legend
    updateBikeLegend("elevation");
}

function updateBikeLegend(category) {
    // Remove existing legend
    svg.selectAll(".legend").remove();

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 200}, ${height - 120})`);

    // Add legend title
    legend.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("class", "text-sm font-bold fill-white")
        .text(category === "distance" ? "Distance (miles)" : "Elevation Gain (ft)");

    // Define legend items based on category
    const legendItems = category === "distance" ? [
        { color: "#FFD700", text: "0.1 - 50 miles" },
        { color: "#FFA500", text: "50 - 199 miles" },
        { color: "#FF0000", text: "200+ miles" }
    ] : [
        { color: "#FFD700", text: "1 - 100 ft" },
        { color: "#FFA500", text: "100 - 1000 ft" },
        { color: "#FF0000", text: "1000+ ft" }
    ];

    const itemSpacing = 25;

    legendItems.forEach((item, i) => {
        const itemGroup = legend.append("g")
            .attr("transform", `translate(0, ${(i + 1) * itemSpacing})`);

        itemGroup.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 5)
            .attr("fill", item.color);

        itemGroup.append("text")
            .attr("x", 15)
            .attr("y", 4)
            .attr("class", "text-sm fill-white")
            .text(item.text);
    });
}

// Initialize bikeMap as null
let bikeMap = null;

// Load bike data
d3.json("data/map_data/bike_centroids.geojson").then(function(bikeData) {
    console.log("Loaded bike data:", bikeData);
    
    // Create a map of fid to bike data
    bikeMap = new Map();
    bikeData.features.forEach(feature => {
        // Only add features that have actual bike data
        if (feature.properties.distance !== null && feature.properties.elevation_gain !== null) {
            bikeMap.set(feature.properties.fid.toString(), feature);
        }
    });

    // Add click handlers for bike filter buttons
    d3.selectAll('.bike-filter').on('click', function() {
        const category = this.getAttribute('data-category');
        // Remove font-bold from all buttons
        d3.selectAll('.bike-filter').classed('font-bold', false);
        // Add font-bold to clicked button
        d3.select(this).classed('font-bold', true);
        
        if (category === 'distance') {
            showBikePointsByDistance();
        } else {
            showBikePointsByElevation();
        }
    });
}).catch(error => {
    console.error("Error loading bike data:", error);
}); 