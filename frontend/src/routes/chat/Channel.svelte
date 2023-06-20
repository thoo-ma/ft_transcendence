<script lang="ts">

  import axios from "../../axios.config";
  import { onDestroy, onMount } from "svelte";
  import { logged, id, user } from "../../stores";
  import { pop } from "svelte-spa-router";
  import ioClient from 'socket.io-client';
  import type { Socket } from "socket.io-client";
  import type { Channel, PostEmitDto, ChannelDto, WsException } from "../../types";

  let socket: Socket = null
  let message: string = ''
  let password: string = ''
  let channel: Channel = null
  let isOwner: boolean = false
  let isAdmin: boolean = false
  let isMember: boolean = false
  let posts: PostEmitDto[] = []
  let channelName: string = null;
  let listChannel: string[] = [];
  let tab:string = "find";
  let chatbox: any

  onMount(() => getChannels())

  onDestroy(() => closeSocket())

  async function getChannels() {
    try {
      const response = await axios.get('/users/me/channel');
      listChannel = response.data;
    } catch (e) {
      console.log(e.response.data.message)
    }
  }

  function closeSocket() {
    if (socket){
      socket.disconnect()
    }
  }

  function post() {
    if (!message || message === '')
      return ;
    socket.emit('sendPost', {
      content: message,
      channelName: channel.name,
    }, (response: string) => {
      console.log(response)
      message = ''
    })
  }

  function joinRoom() {
    socket.emit('joinRoom', channel.name, (response: string) => {
      console.log(response)
    })
  }

  function joinChannel() {
    socket.emit('joinChannel', {
      channelName: channel.name,
      status: channel.status,
      password: password
    } as ChannelDto, (response: string) => {
      console.log(response)
      joinRoom()
    })
  }

  function leaveChannel() {
    socket.emit('leaveChannel', channel.name, (response: string) => {
      console.log(response)
      return pop()
    })
  }

  async function getChannel() {
    try {
      const response = await axios.get(`/channel/${channelName}`)
      channel = response.data
    } catch (e) {
      channel = null
      console.log(e)
    }
  }

  async function revokeAdmin(id: number) {
    try {
      await axios.patch(`/channel/${channel.name}/admin/revoke/${id}`, null)
      getChannel()
    } catch (e) {
      console.log(e.response.data.message)
    }
  }

  async function promoteAdmin(id: number) {
    try {
      await axios.patch(`/channel/${channel.name}/admin/promote/${id}`, null)
      getChannel()
    } catch (e) {
      console.log(e.response.data.message)
    }
  }

  async function ban(userId: number) {
    try {
      const response = await axios.delete(`/channel/${channel.name}/${userId}`)
      console.log(response)
      getChannel()
    } catch (e) {
      console.log(e.response.data.message)
    }
  }

  async function setup(channelName: string) {
    channel = (await axios.get(`/channel/${channelName}`)).data
    socket = ioClient('http://localhost:3000', {
      path: '/chat',
      withCredentials: true
    })

    if (channel.users.find(user => user.id.toString() === $id))
      joinRoom()
    else {
      if (confirm('Join this channel ?') === false)
        return pop()
      if (channel.status === 'Protected') {
        password = prompt('Enter password')
        if (password === '')
          console.error(`Unable to join channel ${channel.name}: Empty password.`)
        if (password === null)
          return pop()
      }
      joinChannel()
    }

    isOwner = channel.ownerId.toString() === $id
    isAdmin = channel.admins.some(admin => admin.id.toString() === $id)
    isMember = true

    socket.on('connect', () => {
      console.log('Connected')
    })

    socket.on('disconnect', (cause) => {
      console.log('Disconnected:', cause)
    })

    socket.on('post', (post: PostEmitDto) => {
      console.log('receive post')
      posts.push(post)
      posts = posts
    })

    // TODO: would be nice to pop _only_ when exception doesn't come from a post failure
    socket.on('exception', (e: WsException) => {
      console.error(e)
      return pop()
    })

    // TODO: is it used ?
    socket.on('error', (e) => {
      console.error(e)
      return pop()
    })

    // TODO: typedef event
    socket.on('channelEvent', (event: any) => {
      if (event.event === 'join') {
        const post: PostEmitDto = { channelName: '', content: `${event.user} joined the channel`, author: 'Event' }
        posts.push(post)
        posts = posts
      }
      else if (event.event === 'leave') {
        const post: PostEmitDto = { channelName: '', content: `${event.user} left the channel`, author: 'Event' }
        posts.push(post)
        posts = posts
      }
    })

  }//fin

  function connectChannel(channel: string)
  {
    channelName = channel;
    setup(channel);
    tab = "channel";
    console.log("yes");
  }


  </script>



<div class="chat-channel">

  <div class="nav">
    {#if tab == "find"}
      <button class="activeButton left" on:click={() => tab = "find"}>Shearch</button>
    {:else}
      <button class="left" on:click={() => tab = "find"}>Shearch</button>
    {/if}

    {#if tab == "channel"}
      <button class="activeButton right" on:click={() => tab = "channel"}>{#if channelName != null} {channelName} {:else} Channel {/if}</button>
    {:else}
      <button class="right" on:click={() => tab = "channel"}>{#if channelName != null} {channelName} {:else} Channel {/if}</button>
    {/if}
  </div>

  {#if tab == "find"}
    <div class="find">
      <div class="title">
        <h2>Your channel</h2>
      </div>
      <div class="list">
        <ul class="friends-list">
          {#each listChannel as channel}
          <li><button on:click={() => connectChannel(channel)}>{channel}</button></li>
        {/each}
        </ul>
      </div>
    </div>
  {:else}

    {#if isMember}
    <div class="marquee-container">
      <div class="marquee" aria-hidden="true">
        <span>name<b>{channel.name}</b></span>
        <span>Status<b>{channel.status}</b></span>
        <span>Owner<b><a contenteditable="false" bind:innerHTML={channel.owner.username} href="#/users/{channel.owner.username}"/></b></span>
        <span>Admins<b>
          {#each channel.admins.filter(admin => admin.id !== channel.ownerId) as admin}
            <a contenteditable="false" bind:innerHTML={admin.username} href="#/users/{admin.username}"/>
            <!-- {#if isOwner}
              <button on:click={() => revokeAdmin(admin.id)}>revoke admin</button>
              <button on:click={() => ban(admin.id)}>ban</button>
            {/if} -->
          {/each}
        </b></span>
        <span>Members<b>
          {#each channel.users.filter(user => !channel.admins.some(admin => admin.id === user.id)) as user}
            <a contenteditable="false" bind:innerHTML={user.username} href="#/users/{user.username}"/>
            <!-- {#if isOwner}
              <button on:click={() => promoteAdmin(user.id)}>promote admin</button>
            {/if}
            {#if isAdmin}
              <button on:click={() => ban(user.id)}>ban</button>
            {/if}-->
          {/each}
        </b>
        </span>
      </div>
    </div>

              <!-- <td>Admins</td>
              <td>
              {#each channel.admins.filter(admin => admin.id !== channel.ownerId) as admin}
                <a contenteditable="false" bind:innerHTML={admin.username} href="#/users/{admin.username}"/>
                {#if isOwner}
                  <button on:click={() => revokeAdmin(admin.id)}>revoke admin</button>
                  <button on:click={() => ban(admin.id)}>ban</button>
                {/if}
              {/each}
              </td> -->
              <!-- <td>Members</td>
              <td>
              {#each channel.users.filter(user => !channel.admins.some(admin => admin.id === user.id)) as user}
                <a contenteditable="false" bind:innerHTML={user.username} href="#/users/{user.username}"/>
                {#if isOwner}
                  <button on:click={() => promoteAdmin(user.id)}>promote admin</button>
                {/if}
                {#if isAdmin}
                  <button on:click={() => ban(user.id)}>ban</button>
                {/if}
              {/each}
              </td>
            </tr> -->
        <!-- <div class="overflow">
          <ul>
            {#each posts as post}
              <li><b>{post.author}</b>: {post.content}</li>
            {/each}
          </ul>
          <form on:submit|preventDefault={post}>
            <input type="text" placeholder="message" bind:value={message}>
            <button type="submit">send</button>
          </form>
        </div>
        <button on:click={() => leaveChannel()}>Leave</button> -->

        <div class="chatbox" bind:this={chatbox}>
        <ul class="message-list">

          {#each posts as post}
          {post.author} {$user.username}
            {#if post.author == $user.username}
            <li class="msg sender">{post.content}</li>
            {:else}
            <li class="msg receiver">{post.content}</li>
            {/if}
            {/each}
          </ul>
      </div>
      <form on:submit|preventDefault={post}>
        <input type="text" placeholder="message" bind:value={message}>
        <button type="submit">send</button>
      </form>
    {/if}
  {/if}


</div>

<style>

.chat-channel{
  background-color: var(--lite-grey);
  border-radius: 15px;
  display: grid;
  grid-template-rows: auto 1fr;
  height: 400px;
  width: 550px;
}

.nav {
    height: 40px;
    display: flex;
    justify-content: space-around;
  }

  .nav button {
    flex: auto;
    font-family: Courier, monospace;
    color: var(--orange);
    background-color: var(--grey);
  }

  .nav .activeButton {
    background-color: none;
    text-decoration: underline;
  }

  .left {
    border-top-left-radius: 15px;
  }

  .right {
    border-top-right-radius: 15px;
  }

  .nav button:not(:last-child) {
    border-right: solid 1px var(--black);
  }

  .find {
    height: 360px;
    background-color: var(--lite-grey);
    border-radius: 0 0 15px 15px;
  }

  .title {
    height: 40px;
    background-color: var(--lite-grey);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .list {
    flex: 1;
    overflow: auto;
  }

  li {
    display: block;
  }


  li {
    height: 40px;
    display: grid;
    grid-template-columns: 1fr;
    background-color: var(--lite-lite-lite-grey);
  }

  li:nth-child(2n + 1) {
    background-color: var(--lite-lite-grey);
  }

  .marquee-container {
  height: 30px;
  overflow: hidden;
  position: relative;
  line-height: 30px;
  }

  .marquee {
    top: 0;
    left: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;
    white-space: nowrap;
    animation: marquee 20s linear infinite;
  }

  .chatbox {
  height: 280px;
  overflow-y: scroll;
  background-color: #333;
  color: #fff;
  border: 2px solid green;
  margin-left: 25%;
  margin-right: 25%;
}


form {
  margin-left: 25%;
  margin-right: 25%;
}

.message-list {
  list-style: none;
  margin: 1rem auto;
  padding: 0;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  --radius-big: 20px;
  --radius-small: 6px;

  word-wrap: break-word;
}

.msg {
  margin-bottom: 6px;
  padding: 12px;
  border-radius: 20px;
  background: #ddd;
  max-width: 150px;
  margin-right: auto;
}

.msg.sender {
  background: #0084ff;
  color: #fff;
  margin-left: auto;
  margin-right: 0;
}

.sender + .sender {
  border-radius: var(--radius-big) var(--radius-small)
    var(--radius-small) var(--radius-big);
}

.receiver + .sender {
  border-bottom-right-radius: var(--radius-small);
}

.sender + .receiver {
  border-radius: var(--radius-big) var(--radius-big)
    var(--radius-small) var(--radius-small);
}

.receiver + .receiver {
  border-radius: var(--radius-small);
}

  *::-webkit-scrollbar {
    display: none;
  }

  @keyframes marquee {
  0% {
    left: 100%;
  }
  100% {
    left: -100%
  }
}


</style>