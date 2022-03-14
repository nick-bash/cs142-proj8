import React from 'react';
import { Typography, Divider} from '@material-ui/core';
import './activityFeed.css';
import axios from 'axios';

class ActivityFeed extends React.Component {
  constructor(props) {
    super(props);     
    this.state = {activities: undefined};
    this.refreshButton = this.refreshButton.bind(this);
  }
  
  render() {        
    if(this.props.loggedInUser === undefined || this.state.activities === undefined) return (<></>);

    console.log("ActivityFeed | rendering");        
    return (
      <div>
        {this.state.activities.map(activity => {
          return (
            <div className="cs142-activity-row" key={activity._id}>
              <Typography className="cs142-activity-row-item">{(new Date(activity.date_time)).toISOString()}</Typography>
              <Typography className="cs142-activity-row-item">{activity.activity}</Typography>
              {
                activity.photo_file_name === null ?
                <></> :
                <img className="cs142-activity-image" src={`../../images/${activity.photo_file_name}`}/>
              }
              <Divider/>
            </div>
          );
        })}
        <button onClick={this.refreshButton}>Refresh the feed</button> 
      </div>
    );
  }  
  
  refreshButton() {
    this.fetchModel();
  }

  fetchModel() {
    var promise = axios.get("/activities");
    promise.then(response => {              
      this.setState({activities: response.data});
      this.props.updateCurrentView("Activity feed");
      })
      .catch(err => console.error(err));
  }

  // Lifecycle handlers
  componentDidMount() {   
    this.fetchModel();    
  }  
  
  componentDidUpdate() { }
}

export default ActivityFeed;