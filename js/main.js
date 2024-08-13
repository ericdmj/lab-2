//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

    //pseudo-global variables
    var attrArray = ["participation_2020", "participation_2016", "participation_2012", "participation_2008","participation_2004"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute
    
    //chart frame dimensions
    var chartWidth = (window.innerWidth * .95) - 20,
        chartHeight = 150,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([140, 0])
        .domain([0, 100]);

    //begin script when window loads
    window.onload = setMap();
    
    //set up choropleth map
    function setMap() {
        
        //map frame dimensions
        var width = window.innerWidth * .95,
            height = window.innerHeight * .95;
    
        //create container div for the map and chart
        var container = d3.select("body")
            .append("div")
            .attr("class", "svg-container");
        
        //create new svg container for the map
        var map = container.append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height)
            .call(d3.zoom() // Add zoom behavior
                .scaleExtent([1, 8]) // Define the minimum and maximum zoom scale
                .on("zoom", zoomed)); // On zoom, call the zoomed function
        
        // Create a group to hold all map elements (paths, etc.)
        var g = map.append("g");

        //create Albers equal area conic projection centered on Virginia
        var projection = d3.geoAlbers()
            .center([0, 37.6])
            .rotate([79.6, 0, 0])
            .parallels([36, 39])
            .scale(7500)
            .translate([width / 2, height / 2]);
    
        var path = d3.geoPath()
            .projection(projection);
    
        //use Promise.all to parallelize asynchronous data loading
        var promises = [];    
        promises.push(d3.csv("data/electionParticipation.csv")); //load attributes from csv    
        promises.push(d3.json("data/UnitedStates.topojson")); //load background spatial data    
        promises.push(d3.json("data/VirginiaMunicipalities.topojson")); //load choropleth spatial data    
        Promise.all(promises).then(callback);
    
        function callback(data) {
            var csvData = data[0],
                united = data[1],
                virginia = data[2];
            console.log(csvData);
            console.log(united);
            console.log(virginia);
    
            //translate US and Virginia TopoJSON
            var unitedStates = topojson.feature(united, united.objects.UnitedStates),
                virginiaMunicipalities = topojson.feature(virginia, virginia.objects.VirginiaMunicipalities).features;
    
            //examine the results
            console.log(unitedStates);
            console.log(virginiaMunicipalities);
    
            //add US States to map
            var states = g.append("path")
                .datum(unitedStates)
                .attr("class", "states")
                .attr("d", path);
    
            //join csv data to GeoJSON enumeration units
            virginiaMunicipalities = joinData(virginiaMunicipalities, csvData);
    
            //create the color scale
            var colorScale = makeColorScale(csvData);
    
            //add enumeration units to the map
            setEnumerationUnits(virginiaMunicipalities, g, path, colorScale);
    
            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            //add dropdown menu to the map
            createDropdown(csvData);

            //create a box element for the map title
            var titleBox = map.append("rect")
                .attr("x", window.innerWidth-653)
                .attr("y", 5)
                .attr("rx", 5)
                .attr("class", "titleBox")
                .attr("height", 50)
                .attr("width", 575);
            
            //create a text element for the map title
            var mapTitle = map.append("text")
                .attr("x", window.innerWidth-633)
                .attr("y", 40)
                .attr("class", "mapTitle")
                .text("Voter Participation by Municipality");

        };

        // Function to handle zoom events
        function zoomed(event) {
            g.attr("transform", event.transform); // Apply the transformation to the group
    }
    
    }; //end of setMap()


    function joinData(virginiaMunicipalities, csvData){
    
        //variables for data join
        //var attrArray = ["participation_2020", "participation_2016", "participation_2012", "participation_2008","participation_2004"];
    
        //loop through csv to assign each set of csv attribute values to geojson municipality
        for (var i=0; i<csvData.length; i++){
            var csvMunicipality = csvData[i]; //the current region
            var csvKey = csvMunicipality.code; //the CSV primary key
    
            //loop through geojson regions to find correct municipality
            for (var a=0; a<virginiaMunicipalities.length; a++){
    
                var geojsonProps = virginiaMunicipalities[a].properties; //the current municipality geojson properties
                var geojsonKey = geojsonProps.code; //the geojson primary key
    
                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){
    
                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvMunicipality[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
    
        return virginiaMunicipalities;
    };




    
    function setEnumerationUnits(virginiaMunicipalities, g, path,colorScale) {
    
            //add Virginia municipalities to map
            var municipalities = g.selectAll(".municipalities")
                .data(virginiaMunicipalities)
                .enter()
                .append("path")
                .attr("class", function(d){
                    return "municipalities " + d.properties.code;
                })
                .attr("d", path)
                .style("fill", function(d){            
                    var value = d.properties[expressed];            
                    if(value) {                
                        return colorScale(value);            
                    } else {                
                        return "#ccc";            
                    }
                })
                // Attach event listeners to the path elements
                .on("mouseover", function(event, d){
                    highlight(d.properties);
                })
                .on("mouseout", function(event, d){
                    dehighlight(d.properties);
                })
                .on("mousemove", moveLabel);
            
            var desc = municipalities.append("desc")
                .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    };
    
    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#bbedda",
            "#9bc7b6",
            "#7da194",
            "#607e72",
            "#445c53"
        ];
    
        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);
    
        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };
    
        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of expressed values as scale domain
        colorScale.domain(domainArray);
    
        console.log(clusters)
    
        return colorScale;
    };
    
    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };

    //dropdown change event handler
    function changeAttribute(attribute, csvData) {
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var municipalities = d3.selectAll(".municipalities")
            .style("fill", function (d) {
                var value = d.properties[expressed];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            });

        //Sort, resize, and recolor bars
        var bars = d3.selectAll(".bar")
            //Sort bars
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            });

        updateChart(bars, csvData.length, colorScale);

    };

    //function to create coordinated bar chart
    function setChart(csvData, colorScale){
        
        // Calculate the vertical position for the chart
        var chartYPosition = window.innerHeight - chartHeight - 39;
        
        //select the container div
        var container = d3.select(".svg-container");

        //create a second svg element to hold the bar chart
        var chart = container.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart")
            .style("position", "absolute")
            .style("left", "30px")
            .style("top", chartYPosition + "px");
    
        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bars for each municipality
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.code;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            
            .on("mouseover", function(event, d){
                highlight(d)
            })
            .on("mouseout", function(event, d){
                dehighlight(d);
            })
            .on("mousemove", moveLabel);

        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", chartWidth-460)
            .attr("y", 30)
            .attr("class", "chartTitle")
            .text("Percentage of voter " + expressed + " in each municipality");
    
        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .ticks(5)
            .scale(yScale);
    
        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);
    
        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        
        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);
        
    };
    
    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale){
        //position bars
        bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 140 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){            
            var value = d[expressed];            
            if(value) {                
                return colorScale(value);            
            } else {                
                return "#ccc";            
            }    
        });

        var chartTitle = d3.select(".chartTitle")
            .text("Percentage of voter " + expressed + " in each municipality");
    }

    //function to highlight enumeration units and bars
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.code)
            .style("stroke", "white")
            .style("stroke-width", "2");
        setLabel(props);
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.code)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    d3.select(".infolabel")
        .remove();
};

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "&#37;</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.code + "_label")
        .html(labelAttribute);

    var municipalityName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.name);
};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = event.clientX + 10,
        y1 = event.clientY - 75,
        x2 = event.clientX - labelWidth - 10,
        y2 = event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};

})(); //last line of main.js