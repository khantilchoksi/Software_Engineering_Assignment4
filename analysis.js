var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var fs = require("fs");

function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		args = ["analysis.js"];
	}
	//args = ["mystery.js"];
	var filePath = args[0];
	
	complexity(filePath);

	// Report
	//Every time we counter new funciton it creates new builder
	for( var node in builders )
	{
		var builder = builders[node];
		builder.report();
	}

}



var builders = {};

// Represent a reusable "class" following the Builder pattern.
function FunctionBuilder()
{
	this.StartLine = 0;
	this.FunctionName = "";
	// The number of parameters for functions
	this.ParameterCount  = 0,
	// Number of if statements/loops + 1
	this.SimpleCyclomaticComplexity = 1;
	// The max depth of scopes (nested ifs, loops, etc)
	this.MaxNestingDepth    = 0;
	// The max number of conditions if one decision statement.
	this.MaxConditions      = 0;
	// The number of return statements
	this.ReturnStatements = 0;
	// Maximum Number of Message Chains
	this.MaximumMessageChains = 0;

	this.report = function()
	{
		console.log(
		   (
		   	"{0}(): {1}\n" +
		   	"============\n" +
			   "SimpleCyclomaticComplexity: {2}\t" +
				"MaxNestingDepth: {3}\t" +
				"MaxConditions: {4}\t" +
				"Parameters: {5}\t"+
				"Return Statemets: {6}\t"+
				"Maximum Message Chains: {7}\n\n"
			)
			.format(this.FunctionName, this.StartLine,
				     this.SimpleCyclomaticComplexity, this.MaxNestingDepth,
			        this.MaxConditions, this.ParameterCount, this.ReturnStatements, this.MaximumMessageChains)
		);
	}
};

// A builder for storing file level information.
function FileBuilder()
{
	this.FileName = "";
	// Number of strings in a file.
	this.Strings = 0;
	// Number of imports in a file.
	this.ImportCount = 0;
	//Number of all conditions
	this.NumberOfConditions = 0;

	this.report = function()
	{
		console.log (
			( "{0}\n" +
			  "~~~~~~~~~~~~\n"+
			  "All Conditions {1} , \t"+
			  "Strings Usage {2} , \t"+
			  "Package Complexity (which is total number of ImportCount) {3}\n" 
			).format( this.FileName, this.NumberOfConditions, this.Strings, this.ImportCount ));
	}
}

// A function following the Visitor pattern.
// Annotates nodes with parent objects.
function traverseWithParents(object, visitor)
{
    var key, child;

    visitor.call(null, object);

    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null && key != 'parent') 
            {
            	child.parent = object;
					traverseWithParents(child, visitor);
            }
        }
    }
}

function complexity(filePath)
{
	var buf = fs.readFileSync(filePath, "utf8");
	var ast = esprima.parse(buf, options);

	var i = 0;

	// A file level-builder:
	var fileBuilder = new FileBuilder();
	fileBuilder.FileName = filePath;
	fileBuilder.ImportCount = 0;
	builders[filePath] = fileBuilder;

	

	// Tranverse program with a function visitor.
	traverseWithParents(ast, function (node) 
	{
		//counting for whole file
		if(node.type === "Literal"){
			if(typeof node.value === 'string')
				fileBuilder.Strings++;
		}

		if(node.name === "require"){

			fileBuilder.ImportCount++;
		}

		//Checking if there is decision like if or while or for loop because it will 
		if(isDecision(node) || node.type === "LogicalExpression"){
			fileBuilder.NumberOfConditions++;
		}		


		if (node.type === 'FunctionDeclaration') 
		{
			var builder = new FunctionBuilder();

			builder.FunctionName = functionName(node);
			builder.StartLine    = node.loc.start.line;

			builder.ParameterCount = node.params.length;

			//Calculating MemberExpressions for chaining x.y.z[0] 
			//Get the memberExpression 
			traverseWithParents(node, function(child){
				if (child.type === 'MemberExpression') {
					var max = 1;
					
					traverseWithParents(child.object, function(grandChild){
					if (grandChild.type === 'MemberExpression') {
						max++;
					}
					});
				builder.MaximumMessageChains = Math.max(max, builder.MaximumMessageChains);

				} 
			});

			//Calculating MaxDepth as explained in class
			var chainArray=[];
			builder.MaxMessageChains = Math.max.apply(Math, chainArray);
			//again setting with empty
			chainArray=[];

			var maximumDepth = 0;
			var childrens = 0;
			var subtract;
			traverseWithParents(node, function(child){
				//First check whether it is if, for or while loop or not
				if (isDecision(child)) {
					traverseWithParents(child, function (grand) {
						//First check whether it is if, for or while loop or not
						if (isDecision(grand)) {
							childrens=childrenLength(grand);
							if(grand.nextSibling){
								subtract += 1;
							}
							maxdepth += 1;
						}
					});
					maxdepth=maxdepth-subtract;
					subtract=0;
					if (maxdepth > builder.MaxNestingDepth) {
						builder.MaxNestingDepth = maxdepth;
					}
				}
				maxdepth=0;
			});

			
			traverseWithParents(node, function (child) 
			{
				if( child.type === "IfStatement"){
					builder.SimpleCyclomaticComplexity++;
					var max = 1;
					//Max Conditions
					traverseWithParents(child.test, function (grandchild) {
						if(grandchild.type === "LogicalExpression"){
							//num conditions
							max++;
						}
					
					});
					//As we have to calculate max from the 
					builder.MaxConditions = Math.max(max, builder.MaxConditions);
					
				}
			});


			//Calculating number of return statements
			traverseWithParents(node, function (child) 
			{
				if (child.type === "ReturnStatement")
					builder.ReturnStatements++;
			});

			//Following is not gonna work to count string literals
			//it will also not count strings outside fucntion
			/*if(node.type === "Literal"){
				fileBuilder.String++;
			}*/

			builders[builder.FunctionName] = builder;
		}

	});

}

// Helper function for counting children of node.
function childrenLength(node)
{
	var key, child;
	var count = 0;
	for (key in node) 
	{
		if (node.hasOwnProperty(key)) 
		{
			child = node[key];
			if (typeof child === 'object' && child !== null && key != 'parent') 
			{
				count++;
			}
		}
	}	
	return count;
}


// Helper function for checking if a node is a "decision type node"
function isDecision(node)
{
	if( node.type == 'IfStatement' || node.type == 'ForStatement' || node.type == 'WhileStatement' ||
		 node.type == 'ForInStatement' || node.type == 'DoWhileStatement')
	{
		return true;
	}
	return false;
}

// Helper function for printing out function name.
function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "anon function @" + node.loc.start.line;
}

// Helper function for allowing parameterized formatting of strings.
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

main();

function Crazy (argument) 
{

	var date_bits = element.value.match(/^(\d{4})\-(\d{1,2})\-(\d{1,2})$/);
	var new_date = null;
	if(date_bits && date_bits.length == 4 && parseInt(date_bits[2]) > 0 && parseInt(date_bits[3]) > 0)
    new_date = new Date(parseInt(date_bits[1]), parseInt(date_bits[2]) - 1, parseInt(date_bits[3]));

    var secs = bytes / 3500;

      if ( secs < 59 )
      {
          return secs.toString().split(".")[0] + " seconds";
      }
      else if ( secs > 59 && secs < 3600 )
      {
          var mints = secs / 60;
          var remainder = parseInt(secs.toString().split(".")[0]) -
(parseInt(mints.toString().split(".")[0]) * 60);
          var szmin;
          if ( mints > 1 )
          {
              szmin = "minutes";
          }
          else
          {
              szmin = "minute";
          }
          return mints.toString().split(".")[0] + " " + szmin + " " +
remainder.toString() + " seconds";
      }
      else
      {
          var mints = secs / 60;
          var hours = mints / 60;
          var remainders = parseInt(secs.toString().split(".")[0]) -
(parseInt(mints.toString().split(".")[0]) * 60);
          var remainderm = parseInt(mints.toString().split(".")[0]) -
(parseInt(hours.toString().split(".")[0]) * 60);
          var szmin;
          if ( remainderm > 1 )
          {
              szmin = "minutes";
          }
          else
          {
              szmin = "minute";
          }
          var szhr;
          if ( remainderm > 1 )
          {
              szhr = "hours";
          }
          else
          {
              szhr = "hour";
              for ( i = 0 ; i < cfield.value.length ; i++)
				  {
				    var n = cfield.value.substr(i,1);
				    if ( n != 'a' && n != 'b' && n != 'c' && n != 'd'
				      && n != 'e' && n != 'f' && n != 'g' && n != 'h'
				      && n != 'i' && n != 'j' && n != 'k' && n != 'l'
				      && n != 'm' && n != 'n' && n != 'o' && n != 'p'
				      && n != 'q' && n != 'r' && n != 's' && n != 't'
				      && n != 'u' && n != 'v' && n != 'w' && n != 'x'
				      && n != 'y' && n != 'z'
				      && n != 'A' && n != 'B' && n != 'C' && n != 'D'
				      && n != 'E' && n != 'F' && n != 'G' && n != 'H'
				      && n != 'I' && n != 'J' && n != 'K' && n != 'L'
				      && n != 'M' && n != 'N' &&  n != 'O' && n != 'P'
				      && n != 'Q' && n != 'R' && n != 'S' && n != 'T'
				      && n != 'U' && n != 'V' && n != 'W' && n != 'X'
				      && n != 'Y' && n != 'Z'
				      && n != '0' && n != '1' && n != '2' && n != '3'
				      && n != '4' && n != '5' && n != '6' && n != '7'
				      && n != '8' && n != '9'
				      && n != '_' && n != '@' && n != '-' && n != '.' )
				    {
				      window.alert("Only Alphanumeric are allowed.\nPlease re-enter the value.");
				      cfield.value = '';
				      cfield.focus();
				    }
				    cfield.value =  cfield.value.toUpperCase();
				  }
				  return;
          }
          return hours.toString().split(".")[0] + " " + szhr + " " +
mints.toString().split(".")[0] + " " + szmin;
      }
  }
 exports.complexity = complexity;
