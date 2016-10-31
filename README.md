# Orbis
Randomly generated terrain on an irregular polygon grid using Voronoi cells spaced using [Poisson-Disk](https://bl.ocks.org/mbostock/19168c663618b7f07158). Terrain heights are a mixture of [Diamond-Square](https://en.wikipedia.org/wiki/Diamond-square_algorithm) for the ocean and distance from coast + randomness for the land. Rivers occupy the middle of a cell and flow to the ocean.

## River algorithm
Each cell is given 1 water point. For each cell, all cell water points are moved to the lowest neighboring land cell. Repeat no more water points on the map. Cells that have more than 500 water points moving between themselves and their neighbors are marked as river cells.



## Example
![Image 1](http://i.imgur.com/0pJsCcZ.png)
![Image 2](http://i.imgur.com/YdwqWYd.png)
