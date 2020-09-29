/* If you're feeling fancy you can add interactivity 
    to your site with Javascript */

// prints "hi" in the browser's dev tools console
console.log("hi");
var ctfSource;
// Marked Element
class MarkdownMarked extends React.Component {
  constructor(props) {
    super(props);
  }
  getMarkdownText() {
    var rawMarkup = marked(this.props.children);
    var cleanMarkup = DOMPurify.sanitize(rawMarkup);
    return { __html: cleanMarkup };
  }
  render() {
    return <div dangerouslySetInnerHTML={this.getMarkdownText()} />;
  }
}
// Da actual code
class MainComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      statusText: "Loading CTF data",
      data: null,
      hashInverseIndexed: {},
      solvedLog: [],
      hashToIndex: {},
    };
  }
  componentDidMount() {
    // Code to run when component is destoryed -> constructor
    if (this.props.ctfSource) {
      this.setState(function (state, props) {
        return {
          statusText: "Downloading CTF data",
        };
      });
      let comp = this;
      fetch(ctfSource)
        .then(async function (req) {
          if (req.status != 200) {
            comp.setState(function (state, props) {
              return {
                statusText: "Error: Bad response code: got " + req.status,
              };
            });
            return;
          }
          comp.setState(function (state, props) {
            return {
              statusText: "Parsing json",
            };
          });
          try {
            let data = await req.json();
            comp.setState(function (state, props) {
              return {
                data: data,
                statusText: "Processing JSON please wait",
              };
            });
            let tempHashInverseIndexing = {};
            let tempHashToIndex = {};
            for (let i = 0; i < data.questions.length; i++) {
              let question = data.questions[i];
              if (question.type == "locked") {
                if (!(question.dependent in tempHashInverseIndexing)) {
                  tempHashInverseIndexing[question.dependent] = [i];
                } else {
                  tempHashInverseIndexing[question.dependent].push(i);
                }
              } else if(question.type == "question"){
                tempHashToIndex[question.answer] = i;
              }
            }
            comp.setState(function (state, props) {
              return {
                data: data,
                statusText: "",
                hashInverseIndexed: tempHashInverseIndexing,
                answers: new Array(data.questions.length).fill(""),
              };
            });
          } catch (err) {
            comp.setState(function (state, props) {
              return {
                statusText: "Bad JSON data failed to parse " + err,
              };
            });
          }
        })
        .catch(function (err) {
          comp.setState(function (state, props) {
            return {
              statusText:
                "CTF data download failed. This can happen if the url is invalid or your internet has issues",
            };
          });
        });
    } else {
      this.setState(function (state, props) {
        return {
          statusText: "No CTF source specified. ",
        };
      });
    }
  }

  componentWillUnmount() {
    // Componoent dies -> deconstructor
  }
  stateChange() {
    this.setState(function (state, props) {
      return {};
    });
  }
  check(index) {
    console.log("Check Function Called " + index);
    let answer = this.state.answers[index];
    let questions = this.state.data.questions.slice();
    let qData = questions[index];
    let salt = "";
    if (qData.hash) {
      salt += qData.salt;
    }
    console.log(answer, questions, qData, this.state.answers);
    let toHash = salt + answer;
    let mode = this.state.data.hashMode || qData.hashMode || "SHA512";
    let encoding = this.state.data.encodeMode || qData.encodeMode || "Hex";
    console.log("To hash: " + toHash);
    let finalHash = CryptoJS[mode](toHash).toString(CryptoJS.enc[encoding]);
    console.log(finalHash);
    let solvedAlready = false;
    if (finalHash == qData.answer) {
      if (questions[index].solved) {
        solvedAlready = true;
      }
      questions[index].solved = true;
      // Unlock new questions
      let inverseHashIndex = this.state.hashInverseIndexed;
      let toUnlock = inverseHashIndex[qData.answer];
      if (toUnlock) {
        for (let i = 0; i < toUnlock.length; i++) {
          let uIndex = toUnlock[i];
          questions[uIndex] = JSON.parse(
            CryptoJS.AES.decrypt(
              questions[uIndex].encryptedQuestionData,
              answer
            ).toString(CryptoJS.enc.Utf8)
          );
        }
      }
      // alert("correct");
    } else {
      if (!("attempts" in questions[index])) {
        questions[index].attempts = 0;
      }

      questions[index].attempts++;
      // alert("incorrect");
    }
    this.setState(function (state, props) {
      let data = state.data;
      data["questions"] = questions;
      let solveLog = state.solvedLog;
      if (!solvedAlready) {
        solveLog.push({ hash: qData.answer, answer: answer });
      }
      return { data: data, solvedLog: solveLog };
    });
  }
  updateData(event) {
    //console.log(event.target);
    let index = parseInt(event.target.getAttribute("data-index"));
    let value = event.target.value;
    this.setState(function (state, props) {
      let answers = state.answers.slice();
      answers[index] = value;
      return { answers: answers };
    });
  }
  render() {
    let contents = [];
    if (this.state.data) {
      let data = this.state.data;
      let thisComp = this;
      contents.push(
        <div className="card">
          <h1>{data.title}</h1>
          <p>
            <MarkdownMarked>{data.desc}</MarkdownMarked>
          </p>
          Protocol: {data.protocol}
        </div>
      );
      contents.push(
        <div className="card">
          <MarkdownMarked>{data.initialText}</MarkdownMarked>
        </div>
      );
      contents.push(
        this.state.data.questions.map(function (questionData, index) {
          if (questionData.type == "locked") {
            return (
              <div className="card">
                This item is locked. You will need to finish some other
                questions.
              </div>
            );
          } else if(questionData.type == "question"){
            let topbar;
            if (questionData.solved) {
              topbar = (
                <div className="solved question-topbar">
                  This question has been solved correctly.{" "}
                </div>
              );
            } else {
              if (questionData.attempts) {
                topbar = (
                  <div className="attempts question-topbar">
                    Attempted{" "}
                    <span class="attempt-counter">{questionData.attempts}</span>{" "}
                    times
                  </div>
                );
              } else {
                topbar = (
                  <div className="not-attempted question-topbar">
                    Not attempted yet
                  </div>
                );
              }
            }
            return (
              <div className="card">
                {topbar}
                <MarkdownMarked>{questionData.content}</MarkdownMarked>
                <input
                  type="text"
                  name="answer"
                  className="answer-input"
                  data-index={index}
                  onKeyUp={thisComp.updateData.bind(thisComp)}
                ></input>
                <button
                  className="answer-submit"
                  data-index={index}
                  data-salt={questionData.salt}
                  data-hash={questionData.answer}
                  onClick={(event) => thisComp.check(index)}
                >
                  Check
                </button>
              </div>
            );
          }else if(questionData.type == "text"){
              return <div className="card">
                <MarkdownMarked>{questionData.content}</MarkdownMarked>
              </div>;
          }
        })
      );
    }
    return (
      <div className="react-wrapper">
        <div className="container">
          <span className="status">{this.state.statusText}</span>
          {contents}
        </div>
        <p>Powered by slctf: Serverless ctf</p>
      </div>
    );
  }
}

// Vanilla js stuff
function start(e) {
  console.log("Window loaded hiding loading message");
  let elems = document.getElementsByClassName("hide-onload");
  for (let i = 0; i < elems.length; i++) {
    elems[i].style.display = "none";
  }
  var url = new URL(location.href);
  ctfSource = url.searchParams.get("source");
  ReactDOM.render(
    <MainComponent ctfSource={ctfSource}></MainComponent>,
    document.getElementById("root")
  );
  console.log("React init success");
}
document.onload = start;
window.onload = start;
document.addEventListener("DOMContentLoaded", function () {
  start(null);
});
if (window.earlyStart) {
  start(null);
}
