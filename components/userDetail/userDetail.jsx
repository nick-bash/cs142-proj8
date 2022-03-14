import React from 'react';
import { Typography } from '@material-ui/core';
import {Link} from 'react-router-dom';
import './userDetail.css';
import axios from 'axios';

/**
 * Define UserDetail, a React componment of CS142 project #5
 */
class UserDetail extends React.Component {
  constructor(props) {   
    super(props);
    this.state = { user: undefined, showDeleteConfirmation: false };

    this.deleteAccountHandler = this.deleteAccountHandler.bind(this);
    this.deleteAccountConfirmation = this.deleteAccountConfirmation.bind(this);
    this.deleteAccountCancellation = this.deleteAccountCancellation.bind(this);
  }

  render() {        
    // Return nothing if the fetch isn't complete
    if(this.state.user === undefined) return (<div/>);

    // Upon rendering, callback to the parent to update the current view context
    let name = this.state.user.first_name + " " + this.state.user.last_name;        

    console.log("user detail rendering");

    return (
      <div>
        <Typography variant="body1">          
          <b>{name}</b>
        </Typography>
        <Typography variant="body1">          
          <b>Description:</b> {this.state.user.description}
        </Typography>
        <Typography variant="body1">          
          <b>Occupation:</b> {this.state.user.occupation}
        </Typography>
        <Typography variant="body1">          
          <b>Location:</b> {this.state.user.location}
        </Typography>
        <Typography variant="body1">
          <b>UserID:</b> {this.state.user._id}
        </Typography> 
        <Link to={`/photos/${this.state.user._id}`} replace>
          <Typography variant="body1">
            <b>Check out {name}&apos;s photos</b>
          </Typography>
        </Link>
        {
          this.props.loggedInUser._id === this.props.match.params.userId ?
          <button className="cs142-delete-account-button" onClick={this.deleteAccountHandler}>Delete my account</button> : 
          <></>
        }
        {
          this.state.showDeleteConfirmation ?
          (
            <div className="cs142-delete-confirmation-div">
            <Typography className="cs142-delete-account-confirmation">Are you sure you want to delete your account?</Typography>
            <button className="cs142-delete-account-button" onClick={this.deleteAccountConfirmation}>Yes</button>
            <button className="cs142-delete-account-button" onClick={this.deleteAccountCancellation}>Cancel</button>
            </div>
          ) : <></>
        }
      </div>
    );
  }  

  deleteAccountHandler() {
    this.setState({showDeleteConfirmation: true});
  }

  deleteAccountConfirmation() {
    var promise = axios.post("delete/user");
    promise.then(response => {
      console.log("UserDetail | Successful account deletion & logout: " + response);
      this.props.updateLoggedInUser(undefined); // set loggedInUser to undefined to re-render the application
    })
    .catch(err => console.error("UserDetail | Error in account deletion: " + err));
  }

  deleteAccountCancellation() {
    this.setState({showDeleteConfirmation: false});
  }
  
  componentDidMount()
  {
    var promise = axios.get("user/" + this.props.match.params.userId);
    promise.then(response => {
        this.setState({user: response.data});
        this.props.updateCurrentView("Details of user: " + this.state.user.first_name + " " + this.state.user.last_name);
      })
      .catch(err => console.error("Error in userDetail axios get: " + err));
  }

  // Re-render when there's new props; but to avoid infinite loop, only setState if the user is new
  componentDidUpdate()
  {
    if(this.props.match.params.userId !== this.state.user?._id) {
      var promise = axios.get("/user/" + this.props.match.params.userId);
      promise.then(response => {
        this.setState({ user: response.data });
        this.props.updateCurrentView("Details of user: " + this.state.user.first_name + " " + this.state.user.last_name);
      })
      .catch(err => console.error(err));    
    }  
  }
}

export default UserDetail;