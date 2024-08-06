//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

    //pseudo-global variables
    var attrArray = ["participation_2020", "participation_2016", "participation_2012", "participation_2008","participation_2004"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute
    
    //begin script when window loads
    window.onload = setMap();
    
    //set up choropleth map
    function setMap() {
        
        //map frame dimensions
        var width = window.innerWidth * .8,
            height = 510;
    
        //create container div for the map and chart
        var container = d3.select("body")
            .append("div")
            .attr("class", "svg-container");
        
        //create new svg container for the map
        var map = container.append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);
    
        //create Albers equal area conic projection centered on France
        var projection = d3.geoAlbers()
            .center([0, 37.2])
            .rotate([79.6, 0, 0])
            .parallels([36, 39])
            .scale(6000)
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
            var states = map.append("path")
                .datum(unitedStates)
                .attr("class", "states")
                .attr("d", path);
    
            //join csv data to GeoJSON enumeration units
            virginiaMunicipalities = joinData(virginiaMunicipalities, csvData);
    
            //create the color scale
            var colorScale = makeColorScale(csvData);
    
            //add enumeration units to the map
            setEnumerationUnits(virginiaMunicipalities, map, path, colorScale);
    
            //add coordinated visualization to the map
            setChart(csvData, colorScale);
        };
    
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
            
    function setEnumerationUnits(virginiaMunicipalities, map, path,colorScale) {
    
            //add Virginia municipalities to map
            var municipalities = map.selectAll(".municipalities")
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
                        return colorScale(d.properties[expressed]);            
                    } else {                
                        return "#ccc";            
                    }
                });
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
    
    //function to create coordinated bar chart
    function setChart(csvData, colorScale){
        //chart frame dimensions
        var chartWidth = (window.innerWidth * .8) - 20,
            chartHeight = 150,
            leftPadding = 25,
            rightPadding = 2,
            topBottomPadding = 5,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
    
        //select the container div
        var container = d3.select(".svg-container");

        //create a second svg element to hold the bar chart
        var chart = container.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
    
        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
    
        //create a scale to size bars proportionally to frame and for axis
        var yScale = d3.scaleLinear()
            .range([140, 0])
            .domain([0, 100]);
    
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
            .attr("x", function(d, i){
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            .attr("height", function(d, i){
                return 140 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            .style("fill", function(d){
                return colorScale(d[expressed]);
            });
    
        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 680)
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
    };
    
})(); //last line of main.js